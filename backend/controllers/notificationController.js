const prisma = require('../config/db');

const getMyNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 20 // Lấy 20 thông báo gần nhất
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy thông báo' });
  }
};

const markAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true }
    });
    res.json({ message: 'Đã đánh dấu đọc tất cả' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi cập nhật thông báo' });
  }
};

module.exports = { getMyNotifications, markAsRead };