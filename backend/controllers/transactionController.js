const prisma = require('../config/db');

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const PAYMENT_METHODS = new Set(['BANK_TRANSFER', 'EWALLET']);

const notifyAccountingTeam = async (tx, title, message, link = null) => {
  const recipients = await tx.user.findMany({
    where: { role: { in: ['ACCOUNTER', 'ADMIN'] } },
    select: { id: true },
  });

  if (recipients.length === 0) return;

  await tx.notification.createMany({
    data: recipients.map((item) => ({
      userId: item.id,
      title,
      message,
      link,
    })),
  });
};

const deposit = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

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

      await tx.transaction.create({
        data: {
          userId,
          amount: numericAmount,
          type: 'DEPOSIT',
          description: `Deposit ${numericAmount} points`,
        },
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

    console.error('deposit error:', error);
    return res.status(500).json({ error: 'Server error while depositing points.' });
  }
};

const requestDeposit = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const amount = toInt(req.body?.amount);
    const method = typeof req.body?.method === 'string' ? req.body.method.trim().toUpperCase() : '';
    const referenceCode = typeof req.body?.referenceCode === 'string' ? req.body.referenceCode.trim() : '';

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
          description: `PENDING|${method}|${referenceCode || 'NO_REF'}`,
        },
      });

      await notifyAccountingTeam(
        tx,
        'New deposit request',
        `User ${userId} requested deposit ${amount} points via ${method}.`,
        null,
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
    const reviewerId = req.user?.userId;
    const transactionId = typeof req.body?.transactionId === 'string' ? req.body.transactionId.trim() : '';
    const approve = Boolean(req.body?.approve);

    if (!reviewerId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!transactionId) return res.status(400).json({ error: 'transactionId is required.' });

    const result = await prisma.$transaction(async (tx) => {
      const requestTx = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!requestTx) throw new Error('REQUEST_NOT_FOUND');
      if (requestTx.type !== 'DEPOSIT_REQUEST') throw new Error('INVALID_REQUEST_TYPE');
      if (!requestTx.description.startsWith('PENDING|')) throw new Error('REQUEST_ALREADY_PROCESSED');

      const status = approve ? 'APPROVED' : 'REJECTED';
      const updatedDescription = `${requestTx.description}|${status}|reviewer:${reviewerId}|at:${new Date().toISOString()}`;

      await tx.transaction.update({
        where: { id: transactionId },
        data: { description: updatedDescription },
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
            description: `Approved request ${requestTx.id}`,
          },
        });
      } else {
        await tx.transaction.create({
          data: {
            userId: requestTx.userId,
            amount: 0,
            type: 'DEPOSIT_REJECTED',
            description: `Rejected request ${requestTx.id}`,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: requestTx.userId,
          title: approve ? 'Deposit approved' : 'Deposit rejected',
          message: approve
            ? `Your deposit request for ${requestTx.amount} points was approved.`
            : `Your deposit request for ${requestTx.amount} points was rejected.`,
          link: null,
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

    console.error('approveDepositRequest error:', error);
    return res.status(500).json({ error: 'Server error while reviewing deposit request.' });
  }
};

const listTransactions = async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit) || 50, 1), 200);
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(type ? { type } : {}),
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
    const operatorId = req.user?.userId;
    const fromUserId = typeof req.body?.fromUserId === 'string' ? req.body.fromUserId.trim() : '';
    const toUserId = typeof req.body?.toUserId === 'string' ? req.body.toUserId.trim() : '';
    const amount = toInt(req.body?.amount);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Manual transfer by accounting';

    if (!operatorId) return res.status(401).json({ error: 'Unauthorized.' });
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
            description: `${reason} | to:${toUserId} | by:${operatorId}`,
          },
          {
            userId: toUserId,
            amount,
            type: 'POINT_TRANSFER_IN',
            description: `${reason} | from:${fromUserId} | by:${operatorId}`,
          },
        ],
      });

      await tx.notification.createMany({
        data: [
          {
            userId: fromUserId,
            title: 'Point transfer',
            message: `${amount} points were transferred out by accounting.`,
            link: null,
          },
          {
            userId: toUserId,
            title: 'Point transfer',
            message: `${amount} points were transferred to your account.`,
            link: null,
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

    console.error('transferPoints error:', error);
    return res.status(500).json({ error: 'Server error while transferring points.' });
  }
};

const buyChapter = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { chapterId } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!chapterId || typeof chapterId !== 'string') {
      return res.status(400).json({ error: 'chapterId is required.' });
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, title: true } } },
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found.' });
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
          description: `Buy chapter: ${chapter.title}`,
        },
      });

      await tx.transaction.create({
        data: {
          userId: chapter.comic.authorId,
          amount: authorRevenue,
          type: 'AUTHOR_REVENUE',
          description: `Revenue from chapter: ${chapter.title}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: chapter.comic.authorId,
          title: 'Chapter purchased',
          message: `A reader purchased your chapter: ${chapter.title}.`,
          link: `/read/${chapterId}`,
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

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Chapter already unlocked.' });
    }

    console.error('buyChapter error:', error);
    return res.status(500).json({ error: 'Server error while purchasing chapter.' });
  }
};

module.exports = {
  deposit,
  requestDeposit,
  approveDepositRequest,
  listTransactions,
  transferPoints,
  buyChapter,
};