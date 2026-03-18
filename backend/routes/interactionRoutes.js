const express = require('express');
const router = express.Router();

const interactionController = require('../controllers/interactionController');
const { protect } = require('../middleware/auth');

router.post('/view/:comicId', interactionController.incrementView);
router.post('/rate', protect, interactionController.rateComic);
router.post('/comment', protect, interactionController.addComment);
router.post('/comment/:id/report', protect, interactionController.reportComment);
router.post('/favorite', protect, interactionController.toggleFavorite);
router.get('/comment/comic/:comicId', interactionController.getComicComments);
router.get('/comment/chapter/:chapterId', interactionController.getChapterComments);
router.get('/comment/:comicId', interactionController.getComments); // backward compatibility

module.exports = router;
