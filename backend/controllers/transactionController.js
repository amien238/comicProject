const prisma = require('../config/db');
const crypto = require('crypto');

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');

const PAYMENT_METHODS = new Set(['BANK_TRANSFER', 'EWALLET']);
const PAYMENT_SUCCESS_STATUSES = new Set(['PAID', 'SUCCESS', 'COMPLETED']);
const PAYMENT_FAIL_STATUSES = new Set(['FAILED', 'CANCELED', 'EXPIRED']);

const ACCOUNT_CODES = {
  PLATFORM_CASH: 'PLATFORM_CASH',
  USER_WALLET: 'USER_WALLET',
  AUTHOR_PAYABLE: 'AUTHOR_PAYABLE',
  PLATFORM_REVENUE: 'PLATFORM_REVENUE',
  WITHDRAWAL_PAYABLE: 'WITHDRAWAL_PAYABLE',
};

const DEPOSIT_SUMMARY_TYPES = ['DEPOSIT', 'DEPOSIT_APPROVED', 'DEPOSIT_WEBHOOK_PAID'];

const buildReferenceCode = (prefix) =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const normalizePaymentStatus = (value) => {
  const normalized = normalize(value).toUpperCase();
  if (!normalized) return 'PENDING';
  if (PAYMENT_SUCCESS_STATUSES.has(normalized)) return 'PAID';
  if (PAYMENT_FAIL_STATUSES.has(normalized)) return normalized;
  if (normalized === 'PROCESSING') return 'PROCESSING';
  return 'PENDING';
};

const notifyAccountingTeam = async (tx, title, message, link = null, metadata = null) => {
  const recipients = await tx.user.findMany({
    where: { role: { in: ['ACCOUNTER', 'ADMIN'] } },
    select: { id: true },
  });

  if (recipients.length === 0) return;

  await tx.notification.createMany({
    data: recipients.map((item) => ({
      userId: item.id,
      type: 'ACCOUNTING',
      title,
      message,
      link,
      metadata,
    })),
  });
};

const ensureOpenPeriod = async (tx, atDate = new Date()) => {
  const year = atDate.getUTCFullYear();
  const month = atDate.getUTCMonth() + 1;

  let period = await tx.accountingPeriod.findUnique({
    where: { year_month: { year, month } },
  });

  if (!period) {
    period = await tx.accountingPeriod.create({
      data: { year, month, status: 'OPEN' },
    });
  }

  if (period.status === 'CLOSED') {
    throw new Error('PERIOD_CLOSED');
  }

  return period;
};

const createJournalEntry = async (
  tx,
  { description, sourceType, sourceId, createdById, postedAt = new Date(), lines },
) => {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('JOURNAL_LINES_REQUIRED');

  const totalDebit = lines.reduce((sum, line) => sum + (toInt(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (toInt(line.credit) || 0), 0);
  if (totalDebit <= 0 || totalCredit <= 0 || totalDebit !== totalCredit) {
    throw new Error('JOURNAL_NOT_BALANCED');
  }

  const period = await ensureOpenPeriod(tx, postedAt);
  const entryCode = buildReferenceCode('JE');

  return tx.journalEntry.create({
    data: {
      entryCode,
      periodId: period.id,
      description,
      sourceType,
      sourceId: sourceId || null,
      createdById: createdById || null,
      postedAt,
      lines: {
        create: lines.map((line) => ({
          accountCode: line.accountCode,
          userId: line.userId || null,
          debit: toInt(line.debit) || 0,
          credit: toInt(line.credit) || 0,
          note: normalize(line.note) || null,
        })),
      },
    },
  });
};

const requireAuthUserId = (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized.' });
    return null;
  }
  return userId;
};

const deposit = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const numericAmount = toInt(req.body?.amount);

    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive integer.' });
    }

    if (numericAmount > 100000000) {
      return res.status(400).json({ error: 'Amount is too large.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!existingUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: numericAmount },
          totalDeposited: { increment: numericAmount },
        },
      });

      const depositTx = await tx.transaction.create({
        data: {
          userId,
          amount: numericAmount,
          type: 'DEPOSIT',
          status: 'SUCCESS',
          referenceCode: buildReferenceCode('DEP'),
          description: `Deposit ${numericAmount} points`,
        },
      });

      await createJournalEntry(tx, {
        description: `Manual deposit ${depositTx.id}`,
        sourceType: 'MANUAL_DEPOSIT',
        sourceId: depositTx.id,
        createdById: userId,
        lines: [
          { accountCode: ACCOUNT_CODES.PLATFORM_CASH, debit: numericAmount, credit: 0 },
          { accountCode: ACCOUNT_CODES.USER_WALLET, userId, debit: 0, credit: numericAmount },
        ],
      });

      return updatedUser;
    });

    return res.json({
      message: 'Deposit successful.',
      currentPoints: result.points,
      totalDeposited: result.totalDeposited,
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (error.message === 'PERIOD_CLOSED') {
      return res.status(409).json({ error: 'Accounting period is closed. Reopen or create next period.' });
    }

    console.error('deposit error:', error);
    return res.status(500).json({ error: 'Server error while depositing points.' });
  }
};

const requestDeposit = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const amount = toInt(req.body?.amount);
    const method = normalize(req.body?.method).toUpperCase();
    const referenceCode = normalize(req.body?.referenceCode);

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive integer.' });
    }

    if (!PAYMENT_METHODS.has(method)) {
      return res.status(400).json({ error: 'method must be BANK_TRANSFER or EWALLET.' });
    }

    const requestTx = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId,
          amount,
          type: 'DEPOSIT_REQUEST',
          status: 'PENDING',
          referenceCode: referenceCode || buildReferenceCode('DR'),
          description: `Request deposit via ${method}`,
          metadata: { method, referenceCode: referenceCode || null },
        },
      });

      await notifyAccountingTeam(
        tx,
        'New deposit request',
        `User ${userId} requested deposit ${amount} points via ${method}.`,
        null,
        { transactionId: created.id },
      );

      return created;
    });

    return res.status(201).json({
      message: 'Deposit request submitted. Waiting for accounting approval.',
      request: requestTx,
    });
  } catch (error) {
    console.error('requestDeposit error:', error);
    return res.status(500).json({ error: 'Server error while creating deposit request.' });
  }
};

const approveDepositRequest = async (req, res) => {
  try {
    const reviewerId = requireAuthUserId(req, res);
    if (!reviewerId) return;

    const transactionId = normalize(req.body?.transactionId);
    const approve = Boolean(req.body?.approve);

    if (!transactionId) return res.status(400).json({ error: 'transactionId is required.' });

    const result = await prisma.$transaction(async (tx) => {
      const requestTx = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!requestTx) throw new Error('REQUEST_NOT_FOUND');
      if (requestTx.type !== 'DEPOSIT_REQUEST') throw new Error('INVALID_REQUEST_TYPE');
      if (requestTx.status !== 'PENDING') throw new Error('REQUEST_ALREADY_PROCESSED');

      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          metadata: {
            ...(requestTx.metadata || {}),
            reviewedBy: reviewerId,
            reviewedAt: new Date().toISOString(),
          },
        },
      });

      if (approve) {
        await tx.user.update({
          where: { id: requestTx.userId },
          data: {
            points: { increment: requestTx.amount },
            totalDeposited: { increment: requestTx.amount },
          },
        });

        await tx.transaction.create({
          data: {
            userId: requestTx.userId,
            amount: requestTx.amount,
            type: 'DEPOSIT_APPROVED',
            status: 'SUCCESS',
            referenceCode: requestTx.referenceCode,
            description: `Approved request ${requestTx.id}`,
          },
        });

        await createJournalEntry(tx, {
          description: `Deposit request approved ${requestTx.id}`,
          sourceType: 'DEPOSIT_REQUEST',
          sourceId: requestTx.id,
          createdById: reviewerId,
          lines: [
            { accountCode: ACCOUNT_CODES.PLATFORM_CASH, debit: requestTx.amount, credit: 0 },
            {
              accountCode: ACCOUNT_CODES.USER_WALLET,
              userId: requestTx.userId,
              debit: 0,
              credit: requestTx.amount,
            },
          ],
        });
      } else {
        await tx.transaction.create({
          data: {
            userId: requestTx.userId,
            amount: 0,
            type: 'DEPOSIT_REJECTED',
            status: 'REJECTED',
            referenceCode: requestTx.referenceCode,
            description: `Rejected request ${requestTx.id}`,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: requestTx.userId,
          type: 'PAYMENT',
          title: approve ? 'Deposit approved' : 'Deposit rejected',
          message: approve
            ? `Your deposit request for ${requestTx.amount} points was approved.`
            : `Your deposit request for ${requestTx.amount} points was rejected.`,
          link: '/profile',
          metadata: { transactionId: requestTx.id },
        },
      });

      return { approve, requestTxId: requestTx.id };
    });

    return res.json({
      message: result.approve ? 'Deposit request approved.' : 'Deposit request rejected.',
      requestTxId: result.requestTxId,
    });
  } catch (error) {
    if (error.message === 'REQUEST_NOT_FOUND') {
      return res.status(404).json({ error: 'Deposit request not found.' });
    }

    if (error.message === 'INVALID_REQUEST_TYPE' || error.message === 'REQUEST_ALREADY_PROCESSED') {
      return res.status(400).json({ error: 'Invalid deposit request state.' });
    }

    if (error.message === 'PERIOD_CLOSED') {
      return res.status(409).json({ error: 'Accounting period is closed. Reopen or create next period.' });
    }

    console.error('approveDepositRequest error:', error);
    return res.status(500).json({ error: 'Server error while reviewing deposit request.' });
  }
};
const createPaymentOrder = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const amount = toInt(req.body?.amount);
    const method = normalize(req.body?.method).toUpperCase();
    const provider = normalize(req.body?.provider) || 'MANUAL_GATEWAY';
    const accountTarget = normalize(req.body?.accountTarget) || null;
    const note = normalize(req.body?.note) || null;
    const expiresMinutes = toInt(req.body?.expiresMinutes) || 30;

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive integer.' });
    }

    if (amount > 100000000) {
      return res.status(400).json({ error: 'amount is too large.' });
    }

    if (!PAYMENT_METHODS.has(method)) {
      return res.status(400).json({ error: 'method must be BANK_TRANSFER or EWALLET.' });
    }

    if (expiresMinutes < 5 || expiresMinutes > 240) {
      return res.status(400).json({ error: 'expiresMinutes must be between 5 and 240.' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const providerOrderId = buildReferenceCode('PO');
      const bankReferenceCode = method === 'BANK_TRANSFER' ? buildReferenceCode('BNK') : null;
      const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

      const order = await tx.paymentOrder.create({
        data: {
          userId,
          amount,
          method,
          provider,
          providerOrderId,
          bankReferenceCode,
          status: 'PENDING',
          qrContent:
            method === 'BANK_TRANSFER'
              ? `pay|${provider}|${bankReferenceCode || providerOrderId}|${amount}|${userId}`
              : null,
          checkoutUrl:
            method === 'EWALLET'
              ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?checkout=${providerOrderId}`
              : null,
          metadata: {
            accountTarget,
            note,
            requestIp: req.ip,
            userAgent: req.headers['user-agent'] || null,
          },
          expiresAt,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount,
          type: 'DEPOSIT_ORDER',
          status: 'PENDING',
          paymentOrderId: order.id,
          referenceCode: order.bankReferenceCode || order.providerOrderId,
          description: `Create payment order ${order.id}`,
          metadata: {
            provider,
            method,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });

      return order;
    });

    return res.status(201).json({
      message: 'Payment order created.',
      order: created,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate payment reference. Please retry.' });
    }

    console.error('createPaymentOrder error:', error);
    return res.status(500).json({ error: 'Server error while creating payment order.' });
  }
};

const listMyPaymentOrders = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const limit = Math.min(Math.max(toInt(req.query?.limit) || 30, 1), 200);

    const orders = await prisma.paymentOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json(orders);
  } catch (error) {
    console.error('listMyPaymentOrders error:', error);
    return res.status(500).json({ error: 'Server error while fetching payment orders.' });
  }
};

const listPaymentOrders = async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query?.limit) || 50, 1), 300);
    const status = normalize(req.query?.status).toUpperCase();
    const method = normalize(req.query?.method).toUpperCase();
    const userId = normalize(req.query?.userId);

    const where = {
      ...(status ? { status } : {}),
      ...(method ? { method } : {}),
      ...(userId ? { userId } : {}),
    };

    const orders = await prisma.paymentOrder.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json(orders);
  } catch (error) {
    console.error('listPaymentOrders error:', error);
    return res.status(500).json({ error: 'Server error while fetching payment orders.' });
  }
};

const handlePaymentWebhook = async (req, res) => {
  try {
    const configuredSecret = normalize(process.env.PAYMENT_WEBHOOK_SECRET);
    if (configuredSecret) {
      const incomingSecret =
        normalize(req.headers['x-payment-secret']) ||
        normalize(req.headers['x-webhook-secret']) ||
        normalize(req.query?.secret);

      if (incomingSecret !== configuredSecret) {
        return res.status(401).json({ error: 'Invalid webhook secret.' });
      }
    }

    const provider = normalize(req.body?.provider) || 'MANUAL_GATEWAY';
    const orderId = normalize(req.body?.orderId);
    const providerOrderId = normalize(req.body?.providerOrderId);
    const providerTxnId = normalize(req.body?.providerTxnId);
    const bankReferenceCode = normalize(req.body?.bankReferenceCode);
    const status = normalizePaymentStatus(req.body?.status);
    const amount = toInt(req.body?.amount);

    if (!orderId && !providerOrderId && !providerTxnId && !bankReferenceCode) {
      return res
        .status(400)
        .json({ error: 'orderId/providerOrderId/providerTxnId/bankReferenceCode is required.' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive integer.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const reconciliation = await tx.reconciliationEvent.create({
        data: {
          provider,
          providerOrderId: providerOrderId || null,
          providerTxnId: providerTxnId || null,
          amount,
          status,
          payload: req.body || null,
        },
      });

      let order = null;

      if (orderId) {
        order = await tx.paymentOrder.findUnique({ where: { id: orderId } });
      }

      if (!order) {
        const candidates = [
          providerOrderId ? { providerOrderId } : null,
          providerTxnId ? { providerTxnId } : null,
          bankReferenceCode ? { bankReferenceCode } : null,
        ].filter(Boolean);

        if (candidates.length > 0) {
          order = await tx.paymentOrder.findFirst({ where: { OR: candidates } });
        }
      }

      if (!order) {
        await tx.reconciliationEvent.update({
          where: { id: reconciliation.id },
          data: {
            reconciliationNote: 'UNMATCHED_ORDER',
          },
        });

        return {
          matched: false,
          eventId: reconciliation.id,
        };
      }

      await tx.reconciliationEvent.update({
        where: { id: reconciliation.id },
        data: {
          matchedOrderId: order.id,
          reconciliationNote: amount !== order.amount ? 'AMOUNT_MISMATCH' : null,
        },
      });

      if (amount !== order.amount) {
        return {
          matched: true,
          orderId: order.id,
          skipped: true,
          reason: 'AMOUNT_MISMATCH',
        };
      }

      if (status === 'PAID') {
        const existingPaidTx = await tx.transaction.findFirst({
          where: {
            paymentOrderId: order.id,
            type: 'DEPOSIT_WEBHOOK_PAID',
          },
          select: { id: true },
        });

        const orderUpdatePayload = {
          status: 'PAID',
          providerTxnId: providerTxnId || order.providerTxnId || null,
          providerOrderId: providerOrderId || order.providerOrderId || null,
          bankReferenceCode: bankReferenceCode || order.bankReferenceCode || null,
          webhookPayload: req.body || null,
          paidAt: order.paidAt || new Date(),
        };

        if (!existingPaidTx) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              points: { increment: order.amount },
              totalDeposited: { increment: order.amount },
            },
          });

          const paidTx = await tx.transaction.create({
            data: {
              userId: order.userId,
              amount: order.amount,
              type: 'DEPOSIT_WEBHOOK_PAID',
              status: 'SUCCESS',
              paymentOrderId: order.id,
              referenceCode:
                providerTxnId || bankReferenceCode || order.bankReferenceCode || providerOrderId || order.providerOrderId,
              description: `Webhook paid order ${order.id}`,
              metadata: {
                provider,
                status,
              },
            },
          });

          await createJournalEntry(tx, {
            description: `Webhook deposit paid ${order.id}`,
            sourceType: 'PAYMENT_WEBHOOK',
            sourceId: order.id,
            lines: [
              { accountCode: ACCOUNT_CODES.PLATFORM_CASH, debit: order.amount, credit: 0 },
              {
                accountCode: ACCOUNT_CODES.USER_WALLET,
                userId: order.userId,
                debit: 0,
                credit: order.amount,
              },
            ],
          });

          await tx.paymentOrder.update({
            where: { id: order.id },
            data: {
              ...orderUpdatePayload,
              transactionId: paidTx.id,
            },
          });

          await tx.notification.create({
            data: {
              userId: order.userId,
              type: 'PAYMENT',
              title: 'Payment confirmed',
              message: `Your deposit ${order.amount} points has been confirmed.`,
              link: '/profile',
              metadata: {
                orderId: order.id,
                transactionId: paidTx.id,
              },
            },
          });
        } else {
          await tx.paymentOrder.update({ where: { id: order.id }, data: orderUpdatePayload });
        }

        return {
          matched: true,
          orderId: order.id,
          status: 'PAID',
          credited: !existingPaidTx,
        };
      }

      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status,
          providerTxnId: providerTxnId || order.providerTxnId || null,
          providerOrderId: providerOrderId || order.providerOrderId || null,
          bankReferenceCode: bankReferenceCode || order.bankReferenceCode || null,
          webhookPayload: req.body || null,
        },
      });

      if (PAYMENT_FAIL_STATUSES.has(status)) {
        const existingFail = await tx.transaction.findFirst({
          where: {
            paymentOrderId: order.id,
            type: 'DEPOSIT_WEBHOOK_FAILED',
          },
          select: { id: true },
        });

        if (!existingFail) {
          await tx.transaction.create({
            data: {
              userId: order.userId,
              amount: 0,
              type: 'DEPOSIT_WEBHOOK_FAILED',
              status,
              paymentOrderId: order.id,
              referenceCode:
                providerTxnId || bankReferenceCode || order.bankReferenceCode || providerOrderId || order.providerOrderId,
              description: `Webhook failed order ${order.id}`,
              metadata: {
                provider,
                status,
              },
            },
          });

          await tx.notification.create({
            data: {
              userId: order.userId,
              type: 'PAYMENT',
              title: 'Payment failed',
              message: `Your payment order ${order.id} failed with status ${status}.`,
              link: '/profile',
              metadata: { orderId: order.id },
            },
          });
        }
      }

      return {
        matched: true,
        orderId: order.id,
        status,
      };
    });

    return res.json({ message: 'Webhook processed.', ...result });
  } catch (error) {
    if (error.message === 'PERIOD_CLOSED') {
      return res.status(409).json({ error: 'Accounting period is closed. Reopen or create next period.' });
    }

    console.error('handlePaymentWebhook error:', error);
    return res.status(500).json({ error: 'Server error while processing payment webhook.' });
  }
};

const requestWithdraw = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const amount = toInt(req.body?.amount);
    const method = normalize(req.body?.method).toUpperCase();
    const accountName = normalize(req.body?.accountName) || null;
    const accountNumber = normalize(req.body?.accountNumber) || null;
    const note = normalize(req.body?.note) || null;

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive integer.' });
    }

    if (!PAYMENT_METHODS.has(method)) {
      return res.status(400).json({ error: 'method must be BANK_TRANSFER or EWALLET.' });
    }

    if (!accountNumber) {
      return res.status(400).json({ error: 'accountNumber is required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, points: true },
      });

      if (!user) throw new Error('USER_NOT_FOUND');
      if (user.points < amount) throw new Error('INSUFFICIENT_FUNDS');

      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: amount } },
      });

      const withdrawRequest = await tx.transaction.create({
        data: {
          userId,
          amount,
          type: 'WITHDRAW_REQUEST',
          status: 'PENDING',
          referenceCode: buildReferenceCode('WDR'),
          description: `Withdraw request ${amount} points via ${method}`,
          metadata: {
            method,
            accountName,
            accountNumber,
            note,
          },
        },
      });

      await createJournalEntry(tx, {
        description: `Withdraw request hold ${withdrawRequest.id}`,
        sourceType: 'WITHDRAW_REQUEST',
        sourceId: withdrawRequest.id,
        createdById: userId,
        lines: [
          { accountCode: ACCOUNT_CODES.USER_WALLET, userId, debit: amount, credit: 0 },
          { accountCode: ACCOUNT_CODES.WITHDRAWAL_PAYABLE, debit: 0, credit: amount },
        ],
      });

      await notifyAccountingTeam(
        tx,
        'New withdraw request',
        `User ${userId} requested withdraw ${amount} points via ${method}.`,
        '/admin',
        { transactionId: withdrawRequest.id },
      );

      await tx.notification.create({
        data: {
          userId,
          type: 'PAYMENT',
          title: 'Withdraw request submitted',
          message: `Your withdraw request ${amount} points is pending accounting review.`,
          link: '/profile',
          metadata: { transactionId: withdrawRequest.id },
        },
      });

      return withdrawRequest;
    });

    return res.status(201).json({
      message: 'Withdraw request submitted.',
      request: result,
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'Not enough points to withdraw.' });
    }

    if (error.message === 'PERIOD_CLOSED') {
      return res.status(409).json({ error: 'Accounting period is closed. Reopen or create next period.' });
    }

    console.error('requestWithdraw error:', error);
    return res.status(500).json({ error: 'Server error while creating withdraw request.' });
  }
};

const reviewWithdrawRequest = async (req, res) => {
  try {
    const reviewerId = requireAuthUserId(req, res);
    if (!reviewerId) return;

    const transactionId = normalize(req.body?.transactionId);
    const approve = Boolean(req.body?.approve);
    const payoutReference = normalize(req.body?.payoutReference) || null;
    const reviewNote = normalize(req.body?.reviewNote) || null;

    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId is required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const requestTx = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!requestTx) throw new Error('REQUEST_NOT_FOUND');
      if (requestTx.type !== 'WITHDRAW_REQUEST') throw new Error('INVALID_REQUEST_TYPE');
      if (requestTx.status !== 'PENDING') throw new Error('REQUEST_ALREADY_PROCESSED');

      await tx.transaction.update({
        where: { id: requestTx.id },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          metadata: {
            ...(requestTx.metadata || {}),
            reviewedBy: reviewerId,
            reviewedAt: new Date().toISOString(),
            payoutReference,
            reviewNote,
          },
        },
      });

      if (approve) {
        const payoutTx = await tx.transaction.create({
          data: {
            userId: requestTx.userId,
            amount: -requestTx.amount,
            type: 'WITHDRAW_APPROVED',
            status: 'SUCCESS',
            referenceCode: payoutReference || requestTx.referenceCode,
            description: `Withdraw approved ${requestTx.id}`,
            metadata: {
              reviewedBy: reviewerId,
              payoutReference,
            },
          },
        });

        await createJournalEntry(tx, {
          description: `Withdraw payout ${requestTx.id}`,
          sourceType: 'WITHDRAW_APPROVED',
          sourceId: payoutTx.id,
          createdById: reviewerId,
          lines: [
            { accountCode: ACCOUNT_CODES.WITHDRAWAL_PAYABLE, debit: requestTx.amount, credit: 0 },
            { accountCode: ACCOUNT_CODES.PLATFORM_CASH, debit: 0, credit: requestTx.amount },
          ],
        });
      } else {
        await tx.user.update({
          where: { id: requestTx.userId },
          data: { points: { increment: requestTx.amount } },
        });

        const rejectTx = await tx.transaction.create({
          data: {
            userId: requestTx.userId,
            amount: requestTx.amount,
            type: 'WITHDRAW_REJECTED',
            status: 'REJECTED',
            referenceCode: requestTx.referenceCode,
            description: `Withdraw rejected ${requestTx.id}`,
            metadata: {
              reviewedBy: reviewerId,
              reviewNote,
            },
          },
        });

        await createJournalEntry(tx, {
          description: `Withdraw reverse ${requestTx.id}`,
          sourceType: 'WITHDRAW_REJECTED',
          sourceId: rejectTx.id,
          createdById: reviewerId,
          lines: [
            { accountCode: ACCOUNT_CODES.WITHDRAWAL_PAYABLE, debit: requestTx.amount, credit: 0 },
            {
              accountCode: ACCOUNT_CODES.USER_WALLET,
              userId: requestTx.userId,
              debit: 0,
              credit: requestTx.amount,
            },
          ],
        });
      }

      await tx.notification.create({
        data: {
          userId: requestTx.userId,
          type: 'PAYMENT',
          title: approve ? 'Withdraw approved' : 'Withdraw rejected',
          message: approve
            ? `Your withdraw request ${requestTx.amount} points has been approved.`
            : `Your withdraw request ${requestTx.amount} points has been rejected and points were returned.`,
          link: '/profile',
          metadata: {
            transactionId: requestTx.id,
            payoutReference,
          },
        },
      });

      return { approve, requestTxId: requestTx.id };
    });

    return res.json({
      message: result.approve ? 'Withdraw request approved.' : 'Withdraw request rejected.',
      requestTxId: result.requestTxId,
    });
  } catch (error) {
    if (error.message === 'REQUEST_NOT_FOUND') {
      return res.status(404).json({ error: 'Withdraw request not found.' });
    }

    if (error.message === 'INVALID_REQUEST_TYPE' || error.message === 'REQUEST_ALREADY_PROCESSED') {
      return res.status(400).json({ error: 'Invalid withdraw request state.' });
    }

    if (error.message === 'PERIOD_CLOSED') {
      return res.status(409).json({ error: 'Accounting period is closed. Reopen or create next period.' });
    }

    console.error('reviewWithdrawRequest error:', error);
    return res.status(500).json({ error: 'Server error while reviewing withdraw request.' });
  }
};
const listTransactions = async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit) || 50, 1), 200);
    const userId = normalize(req.query.userId);
    const type = normalize(req.query.type);
    const status = normalize(req.query.status);

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json(transactions);
  } catch (error) {
    console.error('listTransactions error:', error);
    return res.status(500).json({ error: 'Server error while listing transactions.' });
  }
};

const transferPoints = async (req, res) => {
  try {
    const operatorId = requireAuthUserId(req, res);
    if (!operatorId) return;

    const fromUserId = normalize(req.body?.fromUserId);
    const toUserId = normalize(req.body?.toUserId);
    const amount = toInt(req.body?.amount);
    const reason = normalize(req.body?.reason) || 'Manual transfer by accounting';

    if (!fromUserId || !toUserId || fromUserId === toUserId) {
      return res.status(400).json({ error: 'fromUserId and toUserId must be different valid users.' });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive integer.' });
    }

    await prisma.$transaction(async (tx) => {
      const [fromUser, toUser] = await Promise.all([
        tx.user.findUnique({ where: { id: fromUserId }, select: { id: true, points: true } }),
        tx.user.findUnique({ where: { id: toUserId }, select: { id: true } }),
      ]);

      if (!fromUser || !toUser) throw new Error('USER_NOT_FOUND');
      if (fromUser.points < amount) throw new Error('INSUFFICIENT_FUNDS');

      await tx.user.update({
        where: { id: fromUserId },
        data: { points: { decrement: amount } },
      });

      await tx.user.update({
        where: { id: toUserId },
        data: { points: { increment: amount } },
      });

      await tx.transaction.createMany({
        data: [
          {
            userId: fromUserId,
            amount: -amount,
            type: 'POINT_TRANSFER_OUT',
            status: 'SUCCESS',
            description: `${reason} | to:${toUserId} | by:${operatorId}`,
          },
          {
            userId: toUserId,
            amount,
            type: 'POINT_TRANSFER_IN',
            status: 'SUCCESS',
            description: `${reason} | from:${fromUserId} | by:${operatorId}`,
          },
        ],
      });

      await createJournalEntry(tx, {
        description: `Point transfer ${fromUserId} -> ${toUserId}`,
        sourceType: 'POINT_TRANSFER',
        sourceId: null,
        createdById: operatorId,
        lines: [
          { accountCode: ACCOUNT_CODES.USER_WALLET, userId: fromUserId, debit: amount, credit: 0 },
          { accountCode: ACCOUNT_CODES.USER_WALLET, userId: toUserId, debit: 0, credit: amount },
        ],
      });

      await tx.notification.createMany({
        data: [
          {
            userId: fromUserId,
            type: 'PAYMENT',
            title: 'Point transfer',
            message: `${amount} points were transferred out by accounting.`,
            link: '/profile',
          },
          {
            userId: toUserId,
            type: 'PAYMENT',
            title: 'Point transfer',
            message: `${amount} points were transferred to your account.`,
            link: '/profile',
          },
        ],
      });
    });

    return res.json({ message: 'Point transfer completed.' });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'Source user does not have enough points.' });
    }

    if (error.message === 'PERIOD_CLOSED') {
      return res.status(409).json({ error: 'Accounting period is closed. Reopen or create next period.' });
    }

    console.error('transferPoints error:', error);
    return res.status(500).json({ error: 'Server error while transferring points.' });
  }
};

const buyChapter = async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const chapterId = normalize(req.body?.chapterId);

    if (!chapterId) {
      return res.status(400).json({ error: 'chapterId is required.' });
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        comic: {
          select: {
            id: true,
            title: true,
            authorId: true,
            status: true,
          },
        },
      },
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found.' });
    }

    if (chapter.status !== 'PUBLISHED' || chapter.comic.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'This chapter is currently unavailable.' });
    }

    if (chapter.price === 0) {
      return res.status(400).json({ error: 'This chapter is free.' });
    }

    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = chapter.comic.authorId === userId;
    if (isAdmin || isOwner) {
      return res.status(400).json({ error: 'You can read this chapter without buying.' });
    }

    const alreadyBought = await prisma.unlockedChapter.findUnique({
      where: { userId_chapterId: { userId, chapterId } },
      select: { id: true },
    });

    if (alreadyBought) {
      return res.status(400).json({ error: 'Chapter already unlocked.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, points: true } });
      if (!user) throw new Error('USER_NOT_FOUND');
      if (user.points < chapter.price) throw new Error('INSUFFICIENT_FUNDS');

      const author = await tx.user.findUnique({ where: { id: chapter.comic.authorId }, select: { id: true } });
      if (!author) throw new Error('AUTHOR_NOT_FOUND');

      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: chapter.price } },
      });

      const authorRevenue = Math.floor(chapter.price * 0.7);
      const platformRevenue = chapter.price - authorRevenue;

      await tx.user.update({
        where: { id: chapter.comic.authorId },
        data: { points: { increment: authorRevenue } },
      });

      const unlocked = await tx.unlockedChapter.create({
        data: { userId, chapterId },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: -chapter.price,
          type: 'BUY_CHAPTER',
          status: 'SUCCESS',
          referenceCode: buildReferenceCode('BUY'),
          description: `Buy chapter: ${chapter.title}`,
          metadata: { chapterId },
        },
      });

      await tx.transaction.create({
        data: {
          userId: chapter.comic.authorId,
          amount: authorRevenue,
          type: 'AUTHOR_REVENUE',
          status: 'SUCCESS',
          referenceCode: buildReferenceCode('REV'),
          description: `Revenue from chapter: ${chapter.title}`,
          metadata: {
            chapterId,
            buyerId: userId,
          },
        },
      });

      await createJournalEntry(tx, {
        description: `Chapter purchase ${chapter.id}`,
        sourceType: 'BUY_CHAPTER',
        sourceId: chapter.id,
        createdById: userId,
        lines: [
          { accountCode: ACCOUNT_CODES.USER_WALLET, userId, debit: chapter.price, credit: 0 },
          {
            accountCode: ACCOUNT_CODES.USER_WALLET,
            userId: chapter.comic.authorId,
            debit: 0,
            credit: authorRevenue,
          },
          { accountCode: ACCOUNT_CODES.PLATFORM_REVENUE, debit: 0, credit: platformRevenue },
        ],
      });

      await tx.notification.create({
        data: {
          userId: chapter.comic.authorId,
          type: 'CHAPTER_PURCHASE',
          title: 'Chapter purchased',
          message: `A reader purchased your chapter: ${chapter.title}.`,
          link: `/read/${chapterId}`,
          metadata: {
            chapterId,
            buyerId: userId,
            revenue: authorRevenue,
          },
        },
      });

      return unlocked;
    });

    return res.json({ message: 'Chapter purchased successfully.', unlockedChapterId: result.id });
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'Not enough points.' });
    }

    if (error.message === 'USER_NOT_FOUND' || error.message === 'AUTHOR_NOT_FOUND') {
      return res.status(404).json({ error: 'User data is missing.' });
    }

    if (error.message === 'PERIOD_CLOSED') {
      return res.status(409).json({ error: 'Accounting period is closed. Reopen or create next period.' });
    }

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Chapter already unlocked.' });
    }

    console.error('buyChapter error:', error);
    return res.status(500).json({ error: 'Server error while purchasing chapter.' });
  }
};
const listReconciliation = async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit) || 50, 1), 300);
    const status = normalize(req.query.status);
    const provider = normalize(req.query.provider);
    const unmatchedOnly = req.query.unmatchedOnly === 'true';

    const events = await prisma.reconciliationEvent.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(provider ? { provider } : {}),
        ...(unmatchedOnly ? { matchedOrderId: null } : {}),
      },
      include: {
        matchedOrder: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });

    return res.json(events);
  } catch (error) {
    console.error('listReconciliation error:', error);
    return res.status(500).json({ error: 'Server error while fetching reconciliation events.' });
  }
};

const closeAccountingPeriod = async (req, res) => {
  try {
    const closerId = requireAuthUserId(req, res);
    if (!closerId) return;

    const now = new Date();
    const year = toInt(req.body?.year) || now.getUTCFullYear();
    const month = toInt(req.body?.month) || now.getUTCMonth() + 1;
    const note = normalize(req.body?.note) || null;

    if (year < 2020 || year > 2100) {
      return res.status(400).json({ error: 'year must be between 2020 and 2100.' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'month must be between 1 and 12.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let period = await tx.accountingPeriod.findUnique({
        where: { year_month: { year, month } },
      });

      if (!period) {
        period = await tx.accountingPeriod.create({
          data: { year, month, status: 'OPEN' },
        });
      }

      if (period.status === 'CLOSED') {
        throw new Error('PERIOD_ALREADY_CLOSED');
      }

      const closedPeriod = await tx.accountingPeriod.update({
        where: { id: period.id },
        data: {
          status: 'CLOSED',
          note,
          closedById: closerId,
          closedAt: new Date(),
        },
      });

      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;

      const nextPeriod = await tx.accountingPeriod.upsert({
        where: { year_month: { year: nextYear, month: nextMonth } },
        update: {},
        create: {
          year: nextYear,
          month: nextMonth,
          status: 'OPEN',
        },
      });

      return { closedPeriod, nextPeriod };
    });

    return res.json({
      message: `Accounting period ${year}-${String(month).padStart(2, '0')} closed.`,
      closedPeriod: result.closedPeriod,
      nextPeriod: result.nextPeriod,
    });
  } catch (error) {
    if (error.message === 'PERIOD_ALREADY_CLOSED') {
      return res.status(409).json({ error: 'Accounting period already closed.' });
    }

    console.error('closeAccountingPeriod error:', error);
    return res.status(500).json({ error: 'Server error while closing accounting period.' });
  }
};

const getAccountingSummary = async (req, res) => {
  try {
    const now = new Date();
    const year = toInt(req.query?.year) || now.getUTCFullYear();
    const month = toInt(req.query?.month) || now.getUTCMonth() + 1;

    if (year < 2020 || year > 2100) {
      return res.status(400).json({ error: 'year must be between 2020 and 2100.' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'month must be between 1 and 12.' });
    }

    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const [
      period,
      depositAmount,
      withdrawPaid,
      pendingDepositRequests,
      pendingWithdrawRequests,
      walletLiability,
      accountSums,
      recentTransactions,
    ] = await Promise.all([
      prisma.accountingPeriod.findUnique({ where: { year_month: { year, month } } }),
      prisma.transaction.aggregate({
        where: {
          type: { in: DEPOSIT_SUMMARY_TYPES },
          createdAt: { gte: from, lt: to },
          status: { in: ['SUCCESS', 'PAID'] },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          type: 'WITHDRAW_APPROVED',
          createdAt: { gte: from, lt: to },
          status: 'SUCCESS',
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: {
          type: 'DEPOSIT_REQUEST',
          status: 'PENDING',
          createdAt: { gte: from, lt: to },
        },
      }),
      prisma.transaction.count({
        where: {
          type: 'WITHDRAW_REQUEST',
          status: 'PENDING',
          createdAt: { gte: from, lt: to },
        },
      }),
      prisma.user.aggregate({
        _sum: { points: true },
      }),
      prisma.journalLine.groupBy({
        by: ['accountCode'],
        where: {
          entry: {
            postedAt: { gte: from, lt: to },
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          createdAt: { gte: from, lt: to },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const accountSummary = accountSums.map((item) => ({
      accountCode: item.accountCode,
      debit: item._sum.debit || 0,
      credit: item._sum.credit || 0,
      net: (item._sum.credit || 0) - (item._sum.debit || 0),
    }));

    return res.json({
      period: {
        year,
        month,
        status: period?.status || 'OPEN',
        closedAt: period?.closedAt || null,
      },
      totals: {
        deposited: depositAmount._sum.amount || 0,
        withdrawnPaid: Math.abs(withdrawPaid._sum.amount || 0),
        pendingDepositRequests,
        pendingWithdrawRequests,
        walletLiability: walletLiability._sum.points || 0,
      },
      accountSummary,
      recentTransactions,
    });
  } catch (error) {
    console.error('getAccountingSummary error:', error);
    return res.status(500).json({ error: 'Server error while fetching accounting summary.' });
  }
};

module.exports = {
  deposit,
  requestDeposit,
  approveDepositRequest,
  createPaymentOrder,
  listMyPaymentOrders,
  listPaymentOrders,
  handlePaymentWebhook,
  requestWithdraw,
  reviewWithdrawRequest,
  listTransactions,
  transferPoints,
  buyChapter,
  listReconciliation,
  closeAccountingPeriod,
  getAccountingSummary,
};
