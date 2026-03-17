const jwt = require('jsonwebtoken');

// Middleware 1: Kiểm tra người dùng đã đăng nhập chưa
const protect = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Truy cập bị từ chối! Vui lòng đăng nhập.' });

  jwt.verify(token, process.env.JWT_SECRET || 'secret_tam_thoi', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
    
    req.user = user; 
    next(); 
  });
};

// Middleware 2: Kiểm tra Role tác giả
const isAuthor = (req, res, next) => {
  if (req.user.role !== 'AUTHOR' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn không có quyền! Yêu cầu tài khoản Tác giả.' });
  }
  next();
};

// Middleware 3: Tùy chọn đăng nhập (Dành cho API Đọc truyện)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return next(); // Không có token thì cứ đi tiếp (req.user sẽ bị undefined)

  jwt.verify(token, process.env.JWT_SECRET || 'secret_tam_thoi', (err, user) => {
    if (!err) req.user = user; // Nếu token chuẩn thì gắn user vào
    next();
  });
};

module.exports = { protect, isAuthor, optionalAuth };