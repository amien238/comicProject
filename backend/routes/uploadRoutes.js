const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { upload } = require('../config/cloudinary');

// Middleware xác thực ĐỘC LẬP: Chống tuyệt đối lỗi sai đường dẫn import
const checkAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập để upload file' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'secret_tam_thoi', (err, user) => {
    if (err) return res.status(403).json({ error: 'Phiên đăng nhập hết hạn' });
    req.user = user;
    next();
  });
};

// [POST] Upload 1 ảnh
router.post('/single', checkAuth, (req, res, next) => {
  upload.single('image')(req, res, function (err) {
    if (err) return res.status(400).json({ error: 'Lỗi xử lý ảnh: ' + err.message });
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có ảnh nào được gửi lên' });
  res.json({ message: 'Upload thành công', imageUrl: req.file.path });
});

// [POST] Upload nhiều ảnh (Tối đa 50 ảnh/lần)
router.post('/multiple', checkAuth, (req, res, next) => {
  upload.array('images', 50)(req, res, function (err) {
    if (err) {
      console.error("Lỗi Multer:", err);
      return res.status(400).json({ error: 'Lỗi upload ảnh (Có thể ảnh quá lớn): ' + err.message });
    }
    next();
  });
}, (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Không có ảnh nào được gửi lên' });
  const imageUrls = req.files.map(file => file.path);
  res.json({ message: 'Upload thành công', imageUrls: imageUrls });
});

module.exports = router;