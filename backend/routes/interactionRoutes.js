const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');

// Import middleware xác thực an toàn
const authModule = require('../middleware/auth');
const safeAuth = typeof authModule.protect === 'function' 
    ? authModule.protect 
    : (req, res, next) => {
        return res.status(500).json({ error: 'Lỗi cấu hình xác thực trên Server' });
      };

// Tăng view (Ai cũng gọi được, không cần token)
router.post('/view/:comicId', interactionController.incrementView);

// Các tương tác yêu cầu phải đăng nhập (Có token)
router.post('/rate', safeAuth, interactionController.rateComic);
router.post('/comment', safeAuth, interactionController.addComment);
router.post('/favorite', safeAuth, interactionController.toggleFavorite);

// Lấy danh sách bình luận (Ai cũng xem được)
router.get('/comment/:comicId', interactionController.getComments);

module.exports = router;