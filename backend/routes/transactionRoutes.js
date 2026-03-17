const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/auth'); 

// Mọi giao dịch tiền bạc đều bắt buộc phải đăng nhập (có Token)
router.post('/deposit', protect, transactionController.deposit);
router.post('/buy-chapter', protect, transactionController.buyChapter);

module.exports = router;