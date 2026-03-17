const express = require('express');
const router = express.Router();

const comicsController = require('../controllers/comicsController');
const { protect, isAuthor } = require('../middleware/auth');

router.get('/', comicsController.getAllComics);
router.get('/:id', comicsController.getComicById);
router.post('/', protect, isAuthor, comicsController.createComic);

module.exports = router;