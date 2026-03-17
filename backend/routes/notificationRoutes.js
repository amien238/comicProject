const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Import an toàn trạm kiểm soát Auth
const authMiddleware = require('../middleware/auth');
const protect = authMiddleware.protect || authMiddleware;

// Ai cũng có thể lấy danh sách Tags
router.get('/', notificationController.getMyNotifications);

// Chỉ người đăng nhập (Admin) mới nên tạo Tag mới (Tạm thời dùng token chung để test)
router.post('/', authMiddleware.protect, notificationController.markAsRead);

module.exports = router;