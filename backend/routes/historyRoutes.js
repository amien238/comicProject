const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const { protect } = require('../middleware/auth');

router.post('/update', protect, historyController.updateHistory);
router.get('/me', protect, historyController.getMyHistory);

module.exports = router;