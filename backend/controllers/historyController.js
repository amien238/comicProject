const prisma = require('../config/db');

const updateHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { comicId, chapterId } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!comicId || !chapterId) {
      return res.status(400).json({ error: 'comicId and chapterId are required.' });
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, comicId: true },
    });

    if (!chapter || chapter.comicId !== comicId) {
      return res.status(400).json({ error: 'Invalid comicId/chapterId pair.' });
    }

    const history = await prisma.readingHistory.upsert({
      where: { userId_comicId: { userId, comicId } },
      update: { chapterId, updatedAt: new Date() },
      create: { userId, comicId, chapterId },
    });

    return res.json({ message: 'Reading history updated.', history });
  } catch (error) {
    console.error('updateHistory error:', error);
    return res.status(500).json({ error: 'Server error while updating reading history.' });
  }
};

const getMyHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const history = await prisma.readingHistory.findMany({
      where: { userId },
      include: {
        comic: { select: { id: true, title: true, coverUrl: true } },
        chapter: { select: { id: true, title: true, orderNumber: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return res.json(history);
  } catch (error) {
    console.error('getMyHistory error:', error);
    return res.status(500).json({ error: 'Server error while fetching reading history.' });
  }
};

module.exports = { updateHistory, getMyHistory };