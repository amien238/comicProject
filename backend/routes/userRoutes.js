const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, isAdmin } = require('../middleware/auth'); 

// Tất cả API của người dùng đều cần phải đăng nhập (có Token)
router.get('/me', protect, userController.getMe);
router.get('/me/unlocked-chapters', protect, userController.getMyUnlockedChapters);
router.get('/me/favorites', protect, userController.getMyFavorites);

router.put('/me', protect, userController.updateProfile);

module.exports = router;