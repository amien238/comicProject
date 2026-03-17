const prisma = require('../config/db');

// [POST] Nạp điểm mô phỏng
const deposit = async (req, res) => {
  try {
    const { amount } = req.body; 
    const userId = req.user.userId;

    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Số điểm không hợp lệ.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { 
          points: { increment: numericAmount },
          totalDeposited: { increment: numericAmount } // 👈 THÊM DÒNG NÀY ĐỂ TÍNH TỔNG NẠP LÊN CẤP
        } 
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: numericAmount,
          type: 'DEPOSIT',
          description: `Nạp thành công ${numericAmount} điểm`
        }
      });
      return updatedUser;
    });

    res.json({ message: 'Nạp điểm thành công!', currentPoints: result.points });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi nạp điểm' });
  }
};

// ... giữ nguyên hàm buyChapter cũ ...
const buyChapter = async (req, res) => {
  try {
    const { chapterId } = req.body;
    const userId = req.user.userId;

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: true } 
    });

    if (!chapter) return res.status(404).json({ error: 'Không tìm thấy chương này!' });
    
    const alreadyBought = await prisma.unlockedChapter.findUnique({
      where: {
        userId_chapterId: { userId, chapterId }
      }
    });

    if (alreadyBought || chapter.price === 0) {
      return res.status(400).json({ error: 'Bạn đã sở hữu hoặc chương này miễn phí!' });
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (user.points < chapter.price) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: chapter.price } }
      });

      const authorRevenue = Math.floor(chapter.price * 0.7);

      await tx.user.update({
        where: { id: chapter.comic.authorId },
        data: { points: { increment: authorRevenue } }
      });

      await tx.unlockedChapter.create({
        data: { userId, chapterId }
      });

      await tx.transaction.create({
        data: { userId, amount: -chapter.price, type: 'BUY_CHAPTER', description: `Mua chương: ${chapter.title}` }
      });

      await tx.transaction.create({
        data: { userId: chapter.comic.authorId, amount: authorRevenue, type: 'AUTHOR_REVENUE', description: `Doanh thu từ chương: ${chapter.title}` }
      });
    });

    res.json({ message: 'Mua chương thành công! Bạn có thể bắt đầu đọc.' });

  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'Không đủ điểm để mua chương này!' });
    }
    res.status(500).json({ error: 'Lỗi server khi mua chương' });
  }
};

module.exports = { deposit, buyChapter };