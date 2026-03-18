const prisma = require('../config/db');

const CHAPTER_STATUS_VALUES = new Set(['PUBLISHED', 'HIDDEN', 'ARCHIVED']);

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');

const slugify = (value) =>
  normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

const pad = (value, length) => String(value).padStart(length, '0');

const inferOriginalName = (url, fallbackIndex) => {
  const cleanUrl = normalize(url);
  if (!cleanUrl) return `image_${pad(fallbackIndex, 3)}`;

  try {
    const path = new URL(cleanUrl).pathname;
    const rawName = decodeURIComponent(path.split('/').pop() || '');
    return rawName || `image_${pad(fallbackIndex, 3)}`;
  } catch (_error) {
    const rawName = cleanUrl.split('/').pop() || '';
    return rawName || `image_${pad(fallbackIndex, 3)}`;
  }
};

const buildImageMetadata = ({ comicTitle, chapterOrder, imageUrl, index }) => {
  const comicSlug = slugify(comicTitle) || 'comic';
  const normalizedName = `${comicSlug}_chuong_${pad(chapterOrder, 2)}_image_${pad(index + 1, 3)}`;
  return {
    url: imageUrl,
    pageNumber: index + 1,
    originalName: inferOriginalName(imageUrl, index + 1),
    normalizedName,
    storageKey: normalizedName,
  };
};

const canManage = (reqUser, authorId) => {
  if (!reqUser) return false;
  if (reqUser.role === 'ADMIN') return true;
  return reqUser.userId === authorId;
};

const createChapter = async (req, res) => {
  try {
    const { comicId, title, orderNumber, price, images, status, hiddenReason } = req.body || {};

    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const normalizedComicId = normalize(comicId);
    const normalizedTitle = normalize(title);
    const normalizedOrderNumber = toInt(orderNumber);
    const normalizedPrice = toInt(price ?? 0);
    const normalizedStatus = normalize(status).toUpperCase();
    const normalizedHiddenReason = normalize(hiddenReason) || null;

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
      ? images.map((item) => normalize(typeof item === 'string' ? item : item?.url)).filter(Boolean)
      : [];

    if (normalizedImages.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }

    const comic = await prisma.comic.findUnique({
      where: { id: normalizedComicId },
      select: { id: true, title: true, authorId: true, status: true },
    });

    if (!comic) {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    if (!canManage(req.user, comic.authorId)) {
      return res.status(403).json({ error: 'You can only add chapters to your own comic.' });
    }

    if (comic.status === 'ARCHIVED') {
      return res.status(400).json({ error: 'Cannot add chapter to archived comic.' });
    }

    const existing = await prisma.chapter.findFirst({
      where: { comicId: normalizedComicId, orderNumber: normalizedOrderNumber },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: 'This chapter order already exists.' });
    }

    const safeStatus = CHAPTER_STATUS_VALUES.has(normalizedStatus) ? normalizedStatus : 'PUBLISHED';

    const chapter = await prisma.$transaction(async (tx) => {
      const createdChapter = await tx.chapter.create({
        data: {
          comicId: normalizedComicId,
          title: normalizedTitle,
          orderNumber: normalizedOrderNumber,
          price: normalizedPrice,
          status: safeStatus,
          hiddenReason: safeStatus !== 'PUBLISHED' ? normalizedHiddenReason : null,
          images: {
            create: normalizedImages.map((url, index) =>
              buildImageMetadata({
                comicTitle: comic.title,
                chapterOrder: normalizedOrderNumber,
                imageUrl: url,
                index,
              }),
            ),
          },
        },
        include: {
          images: { orderBy: { pageNumber: 'asc' } },
          comic: { select: { id: true, title: true } },
        },
      });

      await tx.comic.update({
        where: { id: normalizedComicId },
        data: { updatedAt: new Date() },
      });

      if (safeStatus === 'PUBLISHED') {
        const favorites = await tx.favorite.findMany({
          where: { comicId: normalizedComicId },
          select: { userId: true },
        });

        const notificationPayload = favorites
          .filter((fav) => fav.userId !== req.user.userId)
          .map((fav) => ({
            userId: fav.userId,
            type: 'NEW_CHAPTER',
            title: 'New chapter released',
            message: `"${comic.title}" has a new chapter: ${normalizedTitle}`,
            link: `/read/${createdChapter.id}`,
            metadata: { comicId: normalizedComicId, chapterId: createdChapter.id },
          }));

        if (notificationPayload.length > 0) {
          await tx.notification.createMany({ data: notificationPayload });
        }
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
      select: { id: true, authorId: true, status: true },
    });

    if (!comic) {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    const canViewAll = canManage(req.user, comic.authorId);
    if (!canViewAll && comic.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    const chapters = await prisma.chapter.findMany({
      where: {
        comicId,
        ...(canViewAll ? {} : { status: 'PUBLISHED' }),
      },
      orderBy: { orderNumber: 'asc' },
      select: {
        id: true,
        title: true,
        orderNumber: true,
        price: true,
        status: true,
        hiddenReason: true,
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
            status: true,
          },
        },
        images: { orderBy: { pageNumber: 'asc' } },
      },
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found.' });
    }

    const manager = canManage(req.user, chapter.comic.authorId);
    if (!manager) {
      if (chapter.comic.status !== 'PUBLISHED') {
        return res.status(404).json({ error: 'Chapter not found.' });
      }
      if (chapter.status !== 'PUBLISHED') {
        return res.status(404).json({ error: 'Chapter not found.' });
      }
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

const updateChapter = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    const { title, orderNumber, price, images, imageOrder, status, hiddenReason } = req.body || {};

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        comic: { select: { authorId: true, id: true, title: true } },
        images: { orderBy: { pageNumber: 'asc' } },
      },
    });

    if (!chapter) return res.status(404).json({ error: 'Chapter not found.' });

    if (!canManage(req.user, chapter.comic.authorId)) {
      return res.status(403).json({ error: 'You can only edit your own chapter.' });
    }

    const payload = {};
    if (typeof title === 'string' && title.trim()) payload.title = title.trim();

    const normalizedOrderNumber = toInt(orderNumber);
    if (orderNumber !== undefined) {
      if (!Number.isInteger(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
        return res.status(400).json({ error: 'orderNumber must be a positive integer.' });
      }
      payload.orderNumber = normalizedOrderNumber;
    }

    const normalizedPrice = toInt(price);
    if (price !== undefined) {
      if (!Number.isInteger(normalizedPrice) || normalizedPrice < 0) {
        return res.status(400).json({ error: 'price must be an integer >= 0.' });
      }
      payload.price = normalizedPrice;
    }

    const normalizedStatus = normalize(status).toUpperCase();
    if (normalizedStatus) {
      if (!CHAPTER_STATUS_VALUES.has(normalizedStatus)) {
        return res.status(400).json({ error: 'status must be PUBLISHED/HIDDEN/ARCHIVED.' });
      }
      payload.status = normalizedStatus;
      if (normalizedStatus === 'PUBLISHED') {
        payload.hiddenReason = null;
      }
    }

    if (hiddenReason !== undefined) {
      payload.hiddenReason = normalize(hiddenReason) || null;
    }

    const normalizedImages = Array.isArray(images)
      ? images.map((item) => normalize(typeof item === 'string' ? item : item?.url)).filter(Boolean)
      : null;

    if (Array.isArray(images) && (!normalizedImages || normalizedImages.length === 0)) {
      return res.status(400).json({ error: 'images cannot be empty.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const effectiveOrder = normalizedOrderNumber || chapter.orderNumber;
      const effectiveTitle = payload.title || chapter.title;

      if (normalizedImages) {
        await tx.image.deleteMany({ where: { chapterId: id } });
        await tx.image.createMany({
          data: normalizedImages.map((url, index) =>
            buildImageMetadata({
              comicTitle: chapter.comic.title,
              chapterOrder: effectiveOrder,
              imageUrl: url,
              index,
            }),
          ).map((item) => ({ ...item, chapterId: id })),
        });
      } else if (Array.isArray(imageOrder) && imageOrder.length > 0) {
        const existingIds = new Set(chapter.images.map((img) => img.id));
        const normalizedOrder = imageOrder.map((item) => normalize(item)).filter(Boolean);
        if (normalizedOrder.some((imgId) => !existingIds.has(imgId))) {
          return res.status(400).json({ error: 'imageOrder contains invalid image id.' });
        }

        await Promise.all(
          normalizedOrder.map((imgId, index) =>
            {
              const normalizedName = `${slugify(chapter.comic.title) || 'comic'}_chuong_${pad(effectiveOrder, 2)}_image_${pad(index + 1, 3)}`;
              return (
            tx.image.update({
              where: { id: imgId },
              data: {
                pageNumber: index + 1,
                normalizedName,
                storageKey: normalizedName,
              },
              })
              );
            },
          ),
        );
      }

      const chapterUpdate = await tx.chapter.update({
        where: { id },
        data: payload,
        include: {
          images: { orderBy: { pageNumber: 'asc' } },
          comic: { select: { id: true, title: true } },
        },
      });

      await tx.comic.update({
        where: { id: chapterUpdate.comicId },
        data: { updatedAt: new Date() },
      });

      return chapterUpdate;
    });

    return res.json({ message: 'Chapter updated.', chapter: updated });
  } catch (error) {
    console.error('updateChapter error:', error);
    return res.status(500).json({ error: 'Server error while updating chapter.' });
  }
};

const deleteChapter = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: { comic: { select: { id: true, authorId: true } } },
    });

    if (!chapter) return res.status(404).json({ error: 'Chapter not found.' });
    if (!canManage(req.user, chapter.comic.authorId)) {
      return res.status(403).json({ error: 'You can only delete your own chapter.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.chapter.delete({ where: { id } });
      await tx.comic.update({
        where: { id: chapter.comic.id },
        data: { updatedAt: new Date() },
      });
    });

    return res.json({ message: 'Chapter deleted.' });
  } catch (error) {
    console.error('deleteChapter error:', error);
    return res.status(500).json({ error: 'Server error while deleting chapter.' });
  }
};

module.exports = { createChapter, getChaptersByComic, getChapterDetail, updateChapter, deleteChapter };
