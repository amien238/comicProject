const express = require('express');
const router = express.Router();

const chapterController = require('../controllers/chapterController');
const { protect, isAuthor, optionalAuth } = require('../middleware/auth');

router.get('/comic/:comicId', chapterController.getChaptersByComic);
router.post('/', protect, isAuthor, chapterController.createChapter);
router.get('/:id/read', optionalAuth, chapterController.getChapterDetail);

module.exports = router;