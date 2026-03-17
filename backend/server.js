require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. Nhúng file cấu hình Database (để dùng cho API test-db)
// Dựa theo cây thư mục của bạn là: backend/config/db.js
const prisma = require('./config/db'); 

// 2. Nhúng file Routes
// Dựa theo cây thư mục của bạn là: backend/routes/authRoutes.js
const authRoutes = require('./routes/authRoutes');
const comicRoutes = require('./routes/comicsRoutes');
const chapterRoutes = require('./routes/chapterRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const tagsRoutes = require('./routes/tagsRoutes');
const aiRoutes = require('./routes/aiRoutes');
const historyRoutes = require('./routes/historyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');


const app = express();

// Middleware chung
app.use(cors());
app.use(express.json());

// ==========================================
// API GỐC & TEST HỆ THỐNG
// ==========================================
app.get('/', (req, res) => {
  res.send('Chào mừng đến với Backend của AmienComic! 🚀 Hệ thống đã phân chia thư mục chuẩn.');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server AmienComic đang chạy mượt mà 🚀' });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json({ message: 'Kết nối Database thành công! 🎉', userCount: users.length, users });
  } catch (error) {
    console.error('Lỗi DB:', error);
    res.status(500).json({ error: 'Không thể kết nối tới Database', details: error.message });
  }
});

// ==========================================
// KẾT NỐI ROUTER (Chuyển hướng API)
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/comics', comicRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/notification', notificationRoutes);

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
