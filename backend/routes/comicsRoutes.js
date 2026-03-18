const express = require('express');
const router = express.Router();

const comicsController = require('../controllers/comicsController');
const { protect, isAuthor, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, comicsController.getAllComics);
router.get('/mine/list', protect, isAuthor, comicsController.getMyComics);
router.get('/:id', optionalAuth, comicsController.getComicById);
router.post('/', protect, isAuthor, comicsController.createComic);
router.put('/:id', protect, comicsController.updateComic);
router.delete('/:id', protect, comicsController.deleteComic);

module.exports = router;
