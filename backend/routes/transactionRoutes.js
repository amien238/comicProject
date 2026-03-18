const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect, isAccounter } = require('../middleware/auth'); 

// Mọi giao dịch tiền bạc đều bắt buộc phải đăng nhập (có Token)
router.post('/deposit', protect, transactionController.deposit);
router.post('/deposit/request', protect, transactionController.requestDeposit);
router.post('/buy-chapter', protect, transactionController.buyChapter);
router.post('/deposit/review', protect, isAccounter, transactionController.approveDepositRequest);
router.post('/transfer', protect, isAccounter, transactionController.transferPoints);
router.get('/audit', protect, isAccounter, transactionController.listTransactions);

module.exports = router;
