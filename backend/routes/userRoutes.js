const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth'); 

// Tất cả API của người dùng đều cần phải đăng nhập (có Token)
router.get('/me', protect, userController.getMe);
router.get('/me/unlocked-chapters', protect, userController.getMyUnlockedChapters);
router.get('/me/favorites', protect, userController.getMyFavorites);

module.exports = router;