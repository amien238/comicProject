const express = require('express');
const router = express.Router();
const chapterController = require('../controllers/chapterController');

// Nhúng trạm kiểm soát (Nhớ trỏ đúng đường dẫn tới thư mục middleware của bạn)
const { protect, isAuthor, optionalAuth } = require('../middleware/auth'); 

// [GET] Ai cũng xem được danh sách chương (Không cần đăng nhập)
router.get('/comic/:comicId', chapterController.getChaptersByComic);

// [POST] Tác giả đăng chương mới (Cần Token + Quyền Tác giả)
router.post('/', protect, isAuthor, chapterController.createChapter);

// API MỚI: Đọc nội dung chương (Dùng optionalAuth)
router.get('/:id/read', optionalAuth, chapterController.getChapterDetail);

module.exports = router;