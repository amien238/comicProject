const express = require('express');
const router = express.Router();
const comicsController = require('../controllers/comicsController');

router.get('/', comicsController.getAllComics);
router.get('/:id', comicsController.getComicById); // 👈 THÊM DÒNG NÀY
router.post('/', comicsController.createComic);

module.exports = router;