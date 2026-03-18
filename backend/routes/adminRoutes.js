const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { protect, isAdmin } = require('../middleware/auth');

router.use(protect, isAdmin);

router.get('/overview', adminController.getOverview);
router.get('/authors', adminController.listAuthors);

router.get('/comics', adminController.listComics);
router.patch('/comics/:id/moderate', adminController.moderateComic);

router.get('/comments', adminController.listComments);
router.patch('/comments/:id/moderate', adminController.moderateComment);

router.get('/users', adminController.listUsers);
router.get('/users/:id/history', adminController.getUserHistory);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/role', adminController.updateUserRole);

router.get('/tags', adminController.listTags);
router.patch('/tags/:id', adminController.updateTag);

module.exports = router;
