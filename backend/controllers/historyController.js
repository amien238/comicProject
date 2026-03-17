const prisma = require('../config/db');

// [POST] Cập nhật lịch sử đọc (Gọi khi user mở 1 chương truyện)
const updateHistory = async (req, res) => {
  try {
    const { comicId, chapterId } = req.body;
    const userId = req.user.userId;

    const history = await prisma.readingHistory.upsert({
      where: { userId_comicId: { userId, comicId } },
      update: { chapterId, updatedAt: new Date() },
      create: { userId, comicId, chapterId }
    });

    res.json({ message: 'Đã lưu lịch sử đọc', history });
  } catch (error) {
    console.error("Lỗi lưu lịch sử:", error);
    res.status(500).json({ error: 'Lỗi server khi lưu lịch sử' });
  }
};

// [GET] Lấy danh sách truyện vừa đọc của tôi
const getMyHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const history = await prisma.readingHistory.findMany({
      where: { userId },
      include: {
        comic: { select: { title: true, coverUrl: true } },
        chapter: { select: { title: true, orderNumber: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10 // Chỉ lấy 10 truyện gần nhất
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy lịch sử' });
  }
};

module.exports = { updateHistory, getMyHistory };