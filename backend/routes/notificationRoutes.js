const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.get('/', protect, notificationController.getMyNotifications);
router.post('/', protect, notificationController.markAsRead);

module.exports = router;