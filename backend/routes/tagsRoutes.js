const express = require('express');
const router = express.Router();

const tagController = require('../controllers/tagsController');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, tagController.getAllTags);
router.get('/mine', protect, tagController.getMyTags);
router.post('/', protect, tagController.createTag);
router.put('/:id', protect, tagController.updateTag);
router.delete('/:id', protect, tagController.deleteTag);

module.exports = router;
