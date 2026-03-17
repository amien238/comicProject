const express = require('express');
const router = express.Router();

const aiController = require('../controllers/aiController');
const { optionalAuth } = require('../middleware/auth');

router.post('/chat', optionalAuth, aiController.chatWithBot);

module.exports = router;