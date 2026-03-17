const prisma = require('../config/db');

const getMe = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        points: true,
        totalDeposited: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json(user);
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ error: 'Server error while fetching user profile.' });
  }
};

const getMyUnlockedChapters = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const unlocked = await prisma.unlockedChapter.findMany({
      where: { userId },
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            orderNumber: true,
            price: true,
            comic: {
              select: {
                id: true,
                title: true,
                coverUrl: true,
              },
            },
          },
        },
      },
      orderBy: { unlockedAt: 'desc' },
    });

    const formattedData = unlocked.map((item) => ({
      unlockedAt: item.unlockedAt,
      chapterId: item.chapter.id,
      chapterTitle: item.chapter.title,
      chapterOrder: item.chapter.orderNumber,
      chapterPrice: item.chapter.price,
      comicId: item.chapter.comic.id,
      comicTitle: item.chapter.comic.title,
      comicCover: item.chapter.comic.coverUrl,
    }));

    return res.json(formattedData);
  } catch (error) {
    console.error('getMyUnlockedChapters error:', error);
    return res.status(500).json({ error: 'Server error while fetching unlocked chapters.' });
  }
};

const getMyFavorites = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        comic: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            averageRating: true,
            views: true,
            author: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedData = favorites.map((fav) => ({
      comicId: fav.comic.id,
      title: fav.comic.title,
      coverUrl: fav.comic.coverUrl,
      averageRating: fav.comic.averageRating,
      views: fav.comic.views,
      authorName: fav.comic.author?.name || 'Unknown',
    }));

    return res.json(formattedData);
  } catch (error) {
    console.error('getMyFavorites error:', error);
    return res.status(500).json({ error: 'Server error while fetching favorites.' });
  }
};

module.exports = { getMe, getMyUnlockedChapters, getMyFavorites };