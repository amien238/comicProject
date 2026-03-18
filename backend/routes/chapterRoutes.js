const express = require('express');
const router = express.Router();

const chapterController = require('../controllers/chapterController');
const { protect, isAuthor, optionalAuth } = require('../middleware/auth');

router.get('/comic/:comicId', optionalAuth, chapterController.getChaptersByComic);
router.post('/', protect, isAuthor, chapterController.createChapter);
router.put('/:id', protect, isAuthor, chapterController.updateChapter);
router.delete('/:id', protect, isAuthor, chapterController.deleteChapter);
router.get('/:id/read', optionalAuth, chapterController.getChapterDetail);

module.exports = router;
