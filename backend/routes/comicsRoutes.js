const express = require('express');
const router = express.Router();

const comicsController = require('../controllers/comicsController');
const { protect, isAuthor } = require('../middleware/auth');

router.get('/', comicsController.getAllComics);
router.get('/:id', comicsController.getComicById);
router.post('/', protect, isAuthor, comicsController.createComic);
router.put('/:id', protect, comicsController.updateComic);
router.delete('/:id', protect, comicsController.deleteComic);

module.exports = router;
