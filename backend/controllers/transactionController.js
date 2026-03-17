const prisma = require('../config/db');

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const deposit = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const numericAmount = toInt(req.body?.amount);

    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive integer.' });
    }

    if (numericAmount > 100000000) {
      return res.status(400).json({ error: 'Amount is too large.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!existingUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: numericAmount },
          totalDeposited: { increment: numericAmount },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: numericAmount,
          type: 'DEPOSIT',
          description: `Deposit ${numericAmount} points`,
        },
      });

      return updatedUser;
    });

    return res.json({
      message: 'Deposit successful.',
      currentPoints: result.points,
      totalDeposited: result.totalDeposited,
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    console.error('deposit error:', error);
    return res.status(500).json({ error: 'Server error while depositing points.' });
  }
};

const buyChapter = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { chapterId } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!chapterId || typeof chapterId !== 'string') {
      return res.status(400).json({ error: 'chapterId is required.' });
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, title: true } } },
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found.' });
    }

    if (chapter.price === 0) {
      return res.status(400).json({ error: 'This chapter is free.' });
    }

    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = chapter.comic.authorId === userId;
    if (isAdmin || isOwner) {
      return res.status(400).json({ error: 'You can read this chapter without buying.' });
    }

    const alreadyBought = await prisma.unlockedChapter.findUnique({
      where: { userId_chapterId: { userId, chapterId } },
      select: { id: true },
    });

    if (alreadyBought) {
      return res.status(400).json({ error: 'Chapter already unlocked.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, points: true } });
      if (!user) throw new Error('USER_NOT_FOUND');
      if (user.points < chapter.price) throw new Error('INSUFFICIENT_FUNDS');

      const author = await tx.user.findUnique({ where: { id: chapter.comic.authorId }, select: { id: true } });
      if (!author) throw new Error('AUTHOR_NOT_FOUND');

      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: chapter.price } },
      });

      const authorRevenue = Math.floor(chapter.price * 0.7);

      await tx.user.update({
        where: { id: chapter.comic.authorId },
        data: { points: { increment: authorRevenue } },
      });

      const unlocked = await tx.unlockedChapter.create({
        data: { userId, chapterId },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: -chapter.price,
          type: 'BUY_CHAPTER',
          description: `Buy chapter: ${chapter.title}`,
        },
      });

      await tx.transaction.create({
        data: {
          userId: chapter.comic.authorId,
          amount: authorRevenue,
          type: 'AUTHOR_REVENUE',
          description: `Revenue from chapter: ${chapter.title}`,
        },
      });

      return unlocked;
    });

    return res.json({ message: 'Chapter purchased successfully.', unlockedChapterId: result.id });
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'Not enough points.' });
    }

    if (error.message === 'USER_NOT_FOUND' || error.message === 'AUTHOR_NOT_FOUND') {
      return res.status(404).json({ error: 'User data is missing.' });
    }

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Chapter already unlocked.' });
    }

    console.error('buyChapter error:', error);
    return res.status(500).json({ error: 'Server error while purchasing chapter.' });
  }
};

module.exports = { deposit, buyChapter };