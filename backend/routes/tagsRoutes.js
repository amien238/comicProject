const express = require('express');
const router = express.Router();

const tagController = require('../controllers/tagsController');
const { protect } = require('../middleware/auth');

router.get('/', tagController.getAllTags);
router.post('/', protect, tagController.createTag);

module.exports = router;