const prisma = require('../config/db');

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const createChapter = async (req, res) => {
  try {
    const { comicId, title, orderNumber, price, images } = req.body || {};

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const normalizedComicId = typeof comicId === 'string' ? comicId.trim() : '';
    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedOrderNumber = toInt(orderNumber);
    const normalizedPrice = toInt(price ?? 0);

    if (!normalizedComicId || !normalizedTitle) {
      return res.status(400).json({ error: 'comicId and title are required.' });
    }

    if (!Number.isInteger(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
      return res.status(400).json({ error: 'orderNumber must be a positive integer.' });
    }

    if (!Number.isInteger(normalizedPrice) || normalizedPrice < 0) {
      return res.status(400).json({ error: 'price must be an integer >= 0.' });
    }

    const normalizedImages = Array.isArray(images)
      ? images.map((url) => String(url || '').trim()).filter(Boolean)
      : [];

    if (normalizedImages.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }

    const comic = await prisma.comic.findUnique({
      where: { id: normalizedComicId },
      select: { id: true, title: true, authorId: true },
    });

    if (!comic) {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = comic.authorId === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You can only add chapters to your own comic.' });
    }

    const existing = await prisma.chapter.findFirst({
      where: { comicId: normalizedComicId, orderNumber: normalizedOrderNumber },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: 'This chapter order already exists.' });
    }

    const chapter = await prisma.$transaction(async (tx) => {
      const createdChapter = await tx.chapter.create({
        data: {
          comicId: normalizedComicId,
          title: normalizedTitle,
          orderNumber: normalizedOrderNumber,
          price: normalizedPrice,
          images: {
            create: normalizedImages.map((url, index) => ({ url, pageNumber: index + 1 })),
          },
        },
        include: {
          images: { orderBy: { pageNumber: 'asc' } },
          comic: { select: { id: true, title: true } },
        },
      });

      // Keep comic ordering stable for homepage lists ordered by updatedAt.
      await tx.comic.update({
        where: { id: normalizedComicId },
        data: { updatedAt: new Date() },
      });

      const favorites = await tx.favorite.findMany({
        where: { comicId: normalizedComicId },
        select: { userId: true },
      });

      const notificationPayload = favorites
        .filter((fav) => fav.userId !== req.user.userId)
        .map((fav) => ({
          userId: fav.userId,
          title: 'New chapter released',
          message: `"${comic.title}" has a new chapter: ${normalizedTitle}`,
          link: `/read/${createdChapter.id}`,
        }));

      if (notificationPayload.length > 0) {
        await tx.notification.createMany({ data: notificationPayload });
      }

      return createdChapter;
    });

    return res.status(201).json({ message: 'Chapter created successfully.', chapter });
  } catch (error) {
    console.error('createChapter error:', error);
    return res.status(500).json({ error: 'Server error while creating chapter.' });
  }
};

const getChaptersByComic = async (req, res) => {
  try {
    const { comicId } = req.params;

    const comic = await prisma.comic.findUnique({
      where: { id: comicId },
      select: { id: true },
    });

    if (!comic) {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    const chapters = await prisma.chapter.findMany({
      where: { comicId },
      orderBy: { orderNumber: 'asc' },
      select: {
        id: true,
        title: true,
        orderNumber: true,
        price: true,
        createdAt: true,
      },
    });

    return res.json(chapters);
  } catch (error) {
    console.error('getChaptersByComic error:', error);
    return res.status(500).json({ error: 'Server error while fetching chapters.' });
  }
};

const getChapterDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        comic: {
          select: {
            id: true,
            title: true,
            authorId: true,
            coverUrl: true,
          },
        },
        images: { orderBy: { pageNumber: 'asc' } },
      },
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found.' });
    }

    const isFree = chapter.price === 0;
    const isAdmin = req.user?.role === 'ADMIN';
    const isOwner = req.user?.userId === chapter.comic.authorId;

    if (isFree || isAdmin || isOwner) {
      return res.json({
        message: 'Read success.',
        comic: chapter.comic,
        chapter,
        images: chapter.images,
      });
    }

    if (!req.user?.userId) {
      return res.status(403).json({
        error: 'This chapter is paid. Please login first.',
        requiresAuth: true,
        chapterId: chapter.id,
      });
    }

    const hasBought = await prisma.unlockedChapter.findUnique({
      where: {
        userId_chapterId: { userId: req.user.userId, chapterId: id },
      },
      select: { id: true },
    });

    if (!hasBought) {
      return res.status(403).json({
        error: 'You have not purchased this chapter yet.',
        requiresPurchase: true,
        chapterId: chapter.id,
        price: chapter.price,
      });
    }

    return res.json({
      message: 'Read success.',
      comic: chapter.comic,
      chapter,
      images: chapter.images,
    });
  } catch (error) {
    console.error('getChapterDetail error:', error);
    return res.status(500).json({ error: 'Server error while fetching chapter detail.' });
  }
};

module.exports = { createChapter, getChaptersByComic, getChapterDetail };