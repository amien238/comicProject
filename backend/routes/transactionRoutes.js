const express = require('express');
const router = express.Router();

const transactionController = require('../controllers/transactionController');
const { protect, isAccounter } = require('../middleware/auth');

router.post('/deposit', protect, transactionController.deposit);
router.post('/deposit/request', protect, transactionController.requestDeposit);
router.post('/deposit/review', protect, isAccounter, transactionController.approveDepositRequest);

router.post('/payment/order', protect, transactionController.createPaymentOrder);
router.get('/payment/orders/me', protect, transactionController.listMyPaymentOrders);
router.get('/payment/orders', protect, isAccounter, transactionController.listPaymentOrders);
router.post('/payment/webhook', transactionController.handlePaymentWebhook);

router.post('/withdraw/request', protect, transactionController.requestWithdraw);
router.post('/withdraw/review', protect, isAccounter, transactionController.reviewWithdrawRequest);

router.post('/buy-chapter', protect, transactionController.buyChapter);

router.post('/transfer', protect, isAccounter, transactionController.transferPoints);
router.get('/audit', protect, isAccounter, transactionController.listTransactions);
router.get('/reconciliation', protect, isAccounter, transactionController.listReconciliation);
router.post('/period/close', protect, isAccounter, transactionController.closeAccountingPeriod);
router.get('/accounting/summary', protect, isAccounter, transactionController.getAccountingSummary);
router.post('/payment/review', protect, isAccounter, transactionController.reviewPaymentOrder);

module.exports = router;
