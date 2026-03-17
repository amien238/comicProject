const prisma = require('../config/db');

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const incrementView = async (req, res) => {
  const { comicId } = req.params;

  try {
    const updatedComic = await prisma.comic.update({
      where: { id: comicId },
      data: { views: { increment: 1 } },
      select: { views: true },
    });

    return res.json({ message: 'View count increased.', views: updatedComic.views });
  } catch (error) {
    console.error('incrementView error:', error);
    return res.status(404).json({ error: 'Comic not found.' });
  }
};

const rateComic = async (req, res) => {
  const { comicId, score, review } = req.body || {};
  const userId = req.user?.userId;
  const normalizedScore = toInt(score);

  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
  if (!comicId) return res.status(400).json({ error: 'comicId is required.' });
  if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 5) {
    return res.status(400).json({ error: 'score must be between 1 and 5.' });
  }

  try {
    const comic = await prisma.comic.findUnique({ where: { id: comicId }, select: { id: true } });
    if (!comic) return res.status(404).json({ error: 'Comic not found.' });

    await prisma.rating.upsert({
      where: { userId_comicId: { userId, comicId } },
      update: { score: normalizedScore, review: review ? String(review).trim() : null },
      create: { userId, comicId, score: normalizedScore, review: review ? String(review).trim() : null },
    });

    const aggregations = await prisma.rating.aggregate({
      where: { comicId },
      _avg: { score: true },
    });

    const newAverage = Number(aggregations._avg.score || 0);

    await prisma.comic.update({
      where: { id: comicId },
      data: { averageRating: Number(newAverage.toFixed(1)) },
    });

    return res.json({ message: 'Rating saved.', averageRating: Number(newAverage.toFixed(1)) });
  } catch (error) {
    console.error('rateComic error:', error);
    return res.status(500).json({ error: 'Server error while rating comic.' });
  }
};

const toggleFavorite = async (req, res) => {
  const { comicId } = req.body || {};
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
  if (!comicId) return res.status(400).json({ error: 'comicId is required.' });

  try {
    const comic = await prisma.comic.findUnique({ where: { id: comicId }, select: { id: true } });
    if (!comic) return res.status(404).json({ error: 'Comic not found.' });

    const existingFavorite = await prisma.favorite.findUnique({
      where: { userId_comicId: { userId, comicId } },
      select: { id: true },
    });

    if (existingFavorite) {
      await prisma.favorite.delete({ where: { id: existingFavorite.id } });
      return res.json({ message: 'Removed from favorites.', isFavorite: false });
    }

    await prisma.favorite.create({ data: { userId, comicId } });
    return res.json({ message: 'Added to favorites.', isFavorite: true });
  } catch (error) {
    console.error('toggleFavorite error:', error);
    return res.status(500).json({ error: 'Server error while toggling favorite.' });
  }
};

const getComments = async (req, res) => {
  const { comicId } = req.params;

  try {
    const comments = await prisma.comment.findMany({
      where: { comicId, parentId: null },
      include: {
        user: {
          select: {
            name: true,
            avatar: true,
            role: true,
            totalDeposited: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                name: true,
                avatar: true,
                role: true,
                totalDeposited: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(comments);
  } catch (error) {
    console.error('getComments error:', error);
    return res.status(500).json({ error: 'Server error while fetching comments.' });
  }
};

const addComment = async (req, res) => {
  const { comicId, content, parentId } = req.body || {};
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const normalizedComicId = typeof comicId === 'string' ? comicId.trim() : '';
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const normalizedParentId = typeof parentId === 'string' && parentId.trim() ? parentId.trim() : null;

  if (!normalizedComicId || !normalizedContent) {
    return res.status(400).json({ error: 'comicId and content are required.' });
  }

  if (normalizedContent.length > 2000) {
    return res.status(400).json({ error: 'Comment is too long (max 2000 chars).' });
  }

  try {
    const comic = await prisma.comic.findUnique({
      where: { id: normalizedComicId },
      select: { id: true },
    });

    if (!comic) {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    if (normalizedParentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: normalizedParentId },
        select: { id: true, comicId: true },
      });

      if (!parentComment || parentComment.comicId !== normalizedComicId) {
        return res.status(400).json({ error: 'Invalid parent comment.' });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        comicId: normalizedComicId,
        userId,
        content: normalizedContent,
        parentId: normalizedParentId,
      },
      include: {
        user: {
          select: {
            name: true,
            avatar: true,
            role: true,
            totalDeposited: true,
          },
        },
      },
    });

    return res.status(201).json({ message: 'Comment posted.', comment });
  } catch (error) {
    console.error('addComment error:', error);
    return res.status(500).json({ error: 'Server error while posting comment.' });
  }
};

module.exports = { incrementView, rateComic, toggleFavorite, getComments, addComment };