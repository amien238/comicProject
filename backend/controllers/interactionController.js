const prisma = require('../config/db');

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const commentUserSelect = {
  name: true,
  avatar: true,
  role: true,
  totalDeposited: true,
};

const getCommentTree = async (where) => {
  return prisma.comment.findMany({
    where: { ...where, parentId: null, status: 'VISIBLE' },
    include: {
      user: { select: commentUserSelect },
      replies: {
        where: { status: 'VISIBLE' },
        include: { user: { select: commentUserSelect } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
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
      _count: { id: true },
    });

    const newAverage = Number(aggregations._avg.score || 0);
    const ratingCount = Number(aggregations._count.id || 0);

    await prisma.comic.update({
      where: { id: comicId },
      data: { averageRating: Number(newAverage.toFixed(1)) },
    });

    return res.json({
      message: 'Rating saved.',
      averageRating: Number(newAverage.toFixed(1)),
      ratingCount,
      yourScore: normalizedScore,
    });
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

    let isFavorite = false;

    if (existingFavorite) {
      await prisma.favorite.delete({ where: { id: existingFavorite.id } });
      isFavorite = false;
    } else {
      await prisma.favorite.create({ data: { userId, comicId } });
      isFavorite = true;
    }

    const favoriteCount = await prisma.favorite.count({ where: { comicId } });

    return res.json({
      message: isFavorite ? 'Added to favorites.' : 'Removed from favorites.',
      isFavorite,
      favoriteCount,
    });
  } catch (error) {
    console.error('toggleFavorite error:', error);
    return res.status(500).json({ error: 'Server error while toggling favorite.' });
  }
};

const getComicComments = async (req, res) => {
  const { comicId } = req.params;

  try {
    const comments = await getCommentTree({ comicId });
    return res.json(comments);
  } catch (error) {
    console.error('getComicComments error:', error);
    return res.status(500).json({ error: 'Server error while fetching comments.' });
  }
};

const getChapterComments = async (req, res) => {
  const { chapterId } = req.params;

  try {
    const comments = await getCommentTree({ chapterId });
    return res.json(comments);
  } catch (error) {
    console.error('getChapterComments error:', error);
    return res.status(500).json({ error: 'Server error while fetching chapter comments.' });
  }
};

const getComments = getComicComments;

const addComment = async (req, res) => {
  const { comicId, chapterId, content, parentId } = req.body || {};
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const normalizedComicId = typeof comicId === 'string' ? comicId.trim() : '';
  const normalizedChapterId = typeof chapterId === 'string' ? chapterId.trim() : '';
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const normalizedParentId = typeof parentId === 'string' && parentId.trim() ? parentId.trim() : null;

  if (!normalizedContent) {
    return res.status(400).json({ error: 'content is required.' });
  }

  if (normalizedContent.length > 2000) {
    return res.status(400).json({ error: 'Comment is too long (max 2000 chars).' });
  }

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isSuspended: true },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (currentUser.isSuspended) {
      return res.status(403).json({ error: 'Your account is suspended from commenting.' });
    }

    let targetComicId = normalizedComicId || null;
    let targetChapterId = normalizedChapterId || null;
    let parentComment = null;

    if (normalizedParentId) {
      parentComment = await prisma.comment.findUnique({
        where: { id: normalizedParentId },
        select: { id: true, userId: true, comicId: true, chapterId: true, status: true },
      });

      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found.' });
      }

      if (parentComment.status !== 'VISIBLE') {
        return res.status(400).json({ error: 'Cannot reply to a hidden/deleted comment.' });
      }

      targetComicId = parentComment.comicId;
      targetChapterId = parentComment.chapterId;

      if (normalizedComicId && normalizedComicId !== targetComicId) {
        return res.status(400).json({ error: 'Invalid comicId for this reply.' });
      }

      if (normalizedChapterId && normalizedChapterId !== targetChapterId) {
        return res.status(400).json({ error: 'Invalid chapterId for this reply.' });
      }
    } else if (targetChapterId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id: targetChapterId },
        select: { id: true, comicId: true, status: true, comic: { select: { status: true } } },
      });

      if (!chapter) {
        return res.status(404).json({ error: 'Chapter not found.' });
      }

      if (chapter.status !== 'PUBLISHED' || chapter.comic?.status !== 'PUBLISHED') {
        return res.status(400).json({ error: 'Cannot comment on hidden chapter/comic.' });
      }

      targetComicId = chapter.comicId;
    } else if (targetComicId) {
      const comic = await prisma.comic.findUnique({
        where: { id: targetComicId },
        select: { id: true, status: true },
      });

      if (!comic) {
        return res.status(404).json({ error: 'Comic not found.' });
      }

      if (comic.status !== 'PUBLISHED') {
        return res.status(400).json({ error: 'Cannot comment on hidden comic.' });
      }
    } else {
      return res.status(400).json({ error: 'comicId or chapterId is required.' });
    }

    const comic = await prisma.comic.findUnique({
      where: { id: targetComicId },
      select: { id: true, authorId: true, title: true },
    });

    if (!comic) {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    const comment = await prisma.comment.create({
      data: {
        comicId: targetComicId,
        chapterId: targetChapterId,
        userId,
        content: normalizedContent,
        parentId: normalizedParentId,
      },
      include: { user: { select: commentUserSelect } },
    });

    const recipients = new Set();
    if (comic.authorId && comic.authorId !== userId) recipients.add(comic.authorId);
    if (parentComment?.userId && parentComment.userId !== userId) recipients.add(parentComment.userId);

    const link = targetChapterId ? `/read/${targetChapterId}` : `/comic/${targetComicId}`;
    const isReply = Boolean(parentComment);

    if (recipients.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(recipients).map((recipientId) => ({
          userId: recipientId,
          type: isReply ? 'COMMENT_REPLY' : 'COMMENT',
          title: isReply ? 'New reply to your comment' : 'New comment activity',
          message: isReply
            ? `Someone replied on ${comic.title}.`
            : `New comment on ${comic.title}.`,
          link,
        })),
      });
    }

    return res.status(201).json({ message: 'Comment posted.', comment });
  } catch (error) {
    console.error('addComment error:', error);
    return res.status(500).json({ error: 'Server error while posting comment.' });
  }
};

const reportComment = async (req, res) => {
  try {
    const reporterId = req.user?.userId;
    if (!reporterId) return res.status(401).json({ error: 'Unauthorized.' });

    const commentId = typeof req.params?.id === 'string' ? req.params.id.trim() : '';
    if (!commentId) return res.status(400).json({ error: 'Comment id is required.' });

    const updated = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
        select: { id: true, userId: true, content: true, chapterId: true, comicId: true, reportedCount: true },
      });

      if (!comment) throw new Error('COMMENT_NOT_FOUND');

      const next = await tx.comment.update({
        where: { id: commentId },
        data: { reportedCount: { increment: 1 } },
        select: { id: true, reportedCount: true, chapterId: true, comicId: true },
      });

      const admins = await tx.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'REPORT',
            title: 'Comment reported',
            message: `A comment has been reported by user ${reporterId}.`,
            link: '/admin',
            metadata: {
              commentId: comment.id,
              reporterId,
              ownerId: comment.userId,
              reportedCount: next.reportedCount,
            },
          })),
        });
      }

      return next;
    });

    return res.json({ message: 'Comment reported.', report: updated });
  } catch (error) {
    if (error.message === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    console.error('reportComment error:', error);
    return res.status(500).json({ error: 'Server error while reporting comment.' });
  }
};

module.exports = {
  incrementView,
  rateComic,
  toggleFavorite,
  getComments,
  getComicComments,
  getChapterComments,
  addComment,
  reportComment,
};
