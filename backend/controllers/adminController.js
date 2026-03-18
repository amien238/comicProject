const prisma = require('../config/db');

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');
const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getUserTier = (role, totalDeposited) => {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'AUTHOR') return 'AUTHOR';
  if (role === 'ACCOUNTER') return 'ACCOUNTER';

  const total = Number(totalDeposited || 0);
  if (total >= 5000000) return 'PHU_BA';
  if (total >= 2000000) return 'CAP_5';
  if (total >= 1000000) return 'CAP_4';
  if (total >= 500000) return 'CAP_3';
  if (total >= 200000) return 'CAP_2';
  if (total >= 50000) return 'CAP_1';
  return null;
};

const getRequesterMeta = (req) => {
  const xff = req.headers['x-forwarded-for'];
  const ipAddress = Array.isArray(xff)
    ? xff[0]
    : typeof xff === 'string'
      ? xff.split(',')[0].trim()
      : req.ip || null;

  return {
    ipAddress,
    userAgent: normalize(req.headers['user-agent']) || null,
  };
};

const logAdminAction = async (
  tx,
  req,
  { actorId, targetType, targetId, action, reason = null, targetUserId = null, metadata = null },
) => {
  await tx.moderationAction.create({
    data: {
      targetType,
      targetId,
      action,
      reason,
      performedBy: actorId,
    },
  });

  const requesterMeta = getRequesterMeta(req);
  await tx.userAuditLog.create({
    data: {
      actorId,
      targetUserId,
      action,
      ipAddress: requesterMeta.ipAddress,
      userAgent: requesterMeta.userAgent,
      metadata,
    },
  });
};

const getOverview = async (_req, res) => {
  try {
    const [
      userGroups,
      comicGroups,
      commentGroups,
      pendingDepositRequests,
      pendingWithdrawRequests,
      unmatchedReconciliation,
      openPeriod,
      recentModeration,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      prisma.comic.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.comment.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.transaction.count({ where: { type: 'DEPOSIT_REQUEST', status: 'PENDING' } }),
      prisma.transaction.count({ where: { type: 'WITHDRAW_REQUEST', status: 'PENDING' } }),
      prisma.reconciliationEvent.count({ where: { matchedOrderId: null } }),
      prisma.accountingPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
      prisma.moderationAction.findMany({
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const byRole = userGroups.reduce((acc, item) => {
      acc[item.role] = item._count.id;
      return acc;
    }, {});

    const comicByStatus = comicGroups.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    const commentByStatus = commentGroups.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    return res.json({
      users: byRole,
      comics: comicByStatus,
      comments: commentByStatus,
      pendingDepositRequests,
      pendingWithdrawRequests,
      unmatchedReconciliation,
      openPeriod,
      recentModeration,
    });
  } catch (error) {
    console.error('admin.getOverview error:', error);
    return res.status(500).json({ error: 'Server error while fetching admin overview.' });
  }
};

const listAuthors = async (req, res) => {
  try {
    const limit = clamp(toInt(req.query?.limit) || 50, 1, 200);
    const search = normalize(req.query?.search);

    const authors = await prisma.user.findMany({
      where: {
        role: 'AUTHOR',
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        comics: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const mapped = authors.map((author) => {
      const statusMap = author.comics.reduce(
        (acc, comic) => {
          acc.total += 1;
          acc[comic.status] = (acc[comic.status] || 0) + 1;
          return acc;
        },
        { total: 0, PUBLISHED: 0, HIDDEN: 0, ARCHIVED: 0 },
      );

      return {
        id: author.id,
        name: author.name,
        email: author.email,
        avatar: author.avatar,
        warningCount: author.warningCount,
        isSuspended: author.isSuspended,
        createdAt: author.createdAt,
        comicStats: statusMap,
      };
    });

    return res.json(mapped);
  } catch (error) {
    console.error('admin.listAuthors error:', error);
    return res.status(500).json({ error: 'Server error while fetching authors.' });
  }
};

const listComics = async (req, res) => {
  try {
    const limit = clamp(toInt(req.query?.limit) || 50, 1, 300);
    const status = normalize(req.query?.status).toUpperCase();
    const authorId = normalize(req.query?.authorId);
    const search = normalize(req.query?.search);

    const comics = await prisma.comic.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(authorId ? { authorId } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { author: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        tags: { select: { id: true, name: true } },
        _count: { select: { chapters: true, comments: true, favorites: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return res.json(comics);
  } catch (error) {
    console.error('admin.listComics error:', error);
    return res.status(500).json({ error: 'Server error while fetching comics.' });
  }
};

const moderateComic = async (req, res) => {
  try {
    const actorId = req.user?.userId;
    const comicId = normalize(req.params?.id);
    const status = normalize(req.body?.status).toUpperCase();
    const hiddenReason = normalize(req.body?.hiddenReason) || null;
    const violationNote = normalize(req.body?.violationNote) || null;
    const reason = normalize(req.body?.reason) || null;

    if (!actorId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!comicId) return res.status(400).json({ error: 'Comic id is required.' });

    if (!['PUBLISHED', 'HIDDEN', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'status must be PUBLISHED/HIDDEN/ARCHIVED.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const comic = await tx.comic.findUnique({ where: { id: comicId } });
      if (!comic) throw new Error('COMIC_NOT_FOUND');

      const updated = await tx.comic.update({
        where: { id: comicId },
        data: {
          status,
          hiddenReason: status === 'PUBLISHED' ? null : hiddenReason,
          violationNote,
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
          tags: { select: { id: true, name: true } },
        },
      });

      await logAdminAction(tx, req, {
        actorId,
        targetType: 'COMIC',
        targetId: comicId,
        targetUserId: comic.authorId,
        action: `COMIC_${status}`,
        reason,
        metadata: {
          hiddenReason,
          violationNote,
        },
      });

      if (comic.authorId && comic.authorId !== actorId) {
        await tx.notification.create({
          data: {
            userId: comic.authorId,
            type: 'MODERATION',
            title: `Comic status changed: ${status}`,
            message:
              status === 'PUBLISHED'
                ? `Your comic "${comic.title}" is visible again.`
                : `Your comic "${comic.title}" was set to ${status}.`,
            link: `/comic/${comicId}`,
            metadata: {
              comicId,
              status,
              hiddenReason,
              violationNote,
            },
          },
        });
      }

      return updated;
    });

    return res.json({ message: 'Comic moderation updated.', comic: result });
  } catch (error) {
    if (error.message === 'COMIC_NOT_FOUND') {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    console.error('admin.moderateComic error:', error);
    return res.status(500).json({ error: 'Server error while moderating comic.' });
  }
};

const listComments = async (req, res) => {
  try {
    const limit = clamp(toInt(req.query?.limit) || 100, 1, 500);
    const status = normalize(req.query?.status).toUpperCase();
    const comicId = normalize(req.query?.comicId);
    const chapterId = normalize(req.query?.chapterId);
    const search = normalize(req.query?.search);
    const reportedOnly = req.query?.reportedOnly === 'true';

    const comments = await prisma.comment.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(comicId ? { comicId } : {}),
        ...(chapterId ? { chapterId } : {}),
        ...(search ? { content: { contains: search, mode: 'insensitive' } } : {}),
        ...(reportedOnly ? { reportedCount: { gt: 0 } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            totalDeposited: true,
            warningCount: true,
            isSuspended: true,
          },
        },
        comic: { select: { id: true, title: true } },
        chapter: { select: { id: true, title: true, orderNumber: true } },
        parent: { select: { id: true, userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json(comments);
  } catch (error) {
    console.error('admin.listComments error:', error);
    return res.status(500).json({ error: 'Server error while fetching comments.' });
  }
};

const moderateComment = async (req, res) => {
  try {
    const actorId = req.user?.userId;
    const commentId = normalize(req.params?.id);
    const status = normalize(req.body?.status).toUpperCase();
    const moderationNote = normalize(req.body?.moderationNote) || null;
    const reason = normalize(req.body?.reason) || null;
    const warnUser = Boolean(req.body?.warnUser);
    const suspendUser = Boolean(req.body?.suspendUser);

    if (!actorId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!commentId) return res.status(400).json({ error: 'Comment id is required.' });
    if (!['VISIBLE', 'HIDDEN', 'DELETED'].includes(status)) {
      return res.status(400).json({ error: 'status must be VISIBLE/HIDDEN/DELETED.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
        select: {
          id: true,
          userId: true,
          comicId: true,
          chapterId: true,
          content: true,
        },
      });

      if (!comment) throw new Error('COMMENT_NOT_FOUND');

      const updatedComment = await tx.comment.update({
        where: { id: commentId },
        data: {
          status,
          moderationNote,
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          comic: { select: { id: true, title: true } },
          chapter: { select: { id: true, title: true } },
        },
      });

      if (warnUser || suspendUser) {
        await tx.user.update({
          where: { id: comment.userId },
          data: {
            ...(warnUser ? { warningCount: { increment: 1 } } : {}),
            ...(suspendUser ? { isSuspended: true } : {}),
          },
        });
      }

      await logAdminAction(tx, req, {
        actorId,
        targetType: 'COMMENT',
        targetId: commentId,
        targetUserId: comment.userId,
        action: `COMMENT_${status}`,
        reason,
        metadata: {
          moderationNote,
          warnUser,
          suspendUser,
        },
      });

      if (comment.userId !== actorId) {
        await tx.notification.create({
          data: {
            userId: comment.userId,
            type: 'MODERATION',
            title: 'Your comment was moderated',
            message: `Your comment status has been updated to ${status}.`,
            link: comment.chapterId ? `/read/${comment.chapterId}` : comment.comicId ? `/comic/${comment.comicId}` : null,
            metadata: {
              commentId,
              status,
              moderationNote,
            },
          },
        });
      }

      return updatedComment;
    });

    return res.json({ message: 'Comment moderation updated.', comment: result });
  } catch (error) {
    if (error.message === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    console.error('admin.moderateComment error:', error);
    return res.status(500).json({ error: 'Server error while moderating comment.' });
  }
};

const listUsers = async (req, res) => {
  try {
    const limit = clamp(toInt(req.query?.limit) || 100, 1, 400);
    const search = normalize(req.query?.search);
    const role = normalize(req.query?.role).toUpperCase();
    const suspended = normalize(req.query?.suspended);

    const users = await prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(role ? { role } : {}),
        ...(suspended === 'true' ? { isSuspended: true } : {}),
        ...(suspended === 'false' ? { isSuspended: false } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        points: true,
        totalDeposited: true,
        warningCount: true,
        isSuspended: true,
        createdAt: true,
        _count: {
          select: {
            comics: true,
            comments: true,
            transactions: true,
            notifications: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const result = users.map((user) => ({
      ...user,
      tier: getUserTier(user.role, user.totalDeposited),
    }));

    return res.json(result);
  } catch (error) {
    console.error('admin.listUsers error:', error);
    return res.status(500).json({ error: 'Server error while fetching users.' });
  }
};

const getUserHistory = async (req, res) => {
  try {
    const userId = normalize(req.params?.id);
    if (!userId) return res.status(400).json({ error: 'User id is required.' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        points: true,
        totalDeposited: true,
        warningCount: true,
        isSuspended: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const [transactions, auditLogs, comments, notifications] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.userAuditLog.findMany({
        where: {
          OR: [{ actorId: userId }, { targetUserId: userId }],
        },
        include: {
          actor: { select: { id: true, name: true, email: true } },
          targetUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.comment.findMany({
        where: { userId },
        include: {
          comic: { select: { id: true, title: true } },
          chapter: { select: { id: true, title: true, orderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const commentIds = comments.map((comment) => comment.id);
    const moderationOnComments =
      commentIds.length > 0
        ? await prisma.moderationAction.findMany({
            where: {
              targetType: 'COMMENT',
              targetId: { in: commentIds },
            },
            include: {
              actor: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : [];

    return res.json({
      user: {
        ...user,
        tier: getUserTier(user.role, user.totalDeposited),
      },
      transactions,
      auditLogs,
      comments,
      moderationOnComments,
      notifications,
    });
  } catch (error) {
    console.error('admin.getUserHistory error:', error);
    return res.status(500).json({ error: 'Server error while fetching user history.' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const actorId = req.user?.userId;
    const userId = normalize(req.params?.id);
    const isSuspended = req.body?.isSuspended;
    const warningCount = req.body?.warningCount;
    const warningDelta = req.body?.warningDelta;
    const reason = normalize(req.body?.reason) || null;

    if (!actorId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!userId) return res.status(400).json({ error: 'User id is required.' });

    const payload = {};

    if (typeof isSuspended === 'boolean') payload.isSuspended = isSuspended;

    if (warningCount !== undefined) {
      const count = toInt(warningCount);
      if (!Number.isInteger(count) || count < 0) {
        return res.status(400).json({ error: 'warningCount must be an integer >= 0.' });
      }
      payload.warningCount = count;
    } else if (warningDelta !== undefined) {
      const delta = toInt(warningDelta);
      if (!Number.isInteger(delta)) {
        return res.status(400).json({ error: 'warningDelta must be an integer.' });
      }
      payload.warningCount = { increment: delta };
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No status field to update.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
      if (!existing) throw new Error('USER_NOT_FOUND');

      const updated = await tx.user.update({
        where: { id: userId },
        data: payload,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          points: true,
          totalDeposited: true,
          warningCount: true,
          isSuspended: true,
          createdAt: true,
        },
      });

      await logAdminAction(tx, req, {
        actorId,
        targetType: 'USER',
        targetId: userId,
        targetUserId: userId,
        action: 'USER_STATUS_UPDATE',
        reason,
        metadata: payload,
      });

      if (userId !== actorId) {
        await tx.notification.create({
          data: {
            userId,
            type: 'MODERATION',
            title: 'Your account status was updated',
            message: 'An administrator updated your account status.',
            link: '/profile',
            metadata: {
              isSuspended: updated.isSuspended,
              warningCount: updated.warningCount,
            },
          },
        });
      }

      return updated;
    });

    return res.json({ message: 'User status updated.', user: result });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    console.error('admin.updateUserStatus error:', error);
    return res.status(500).json({ error: 'Server error while updating user status.' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const actorId = req.user?.userId;
    const userId = normalize(req.params?.id);
    const role = normalize(req.body?.role).toUpperCase();
    const reason = normalize(req.body?.reason) || null;

    if (!actorId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!userId) return res.status(400).json({ error: 'User id is required.' });

    if (!['USER', 'AUTHOR', 'ADMIN', 'ACCOUNTER'].includes(role)) {
      return res.status(400).json({ error: 'role must be USER/AUTHOR/ADMIN/ACCOUNTER.' });
    }

    if (actorId === userId && role !== 'ADMIN') {
      return res.status(400).json({ error: 'You cannot remove your own admin role.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
      if (!existing) throw new Error('USER_NOT_FOUND');

      const user = await tx.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          points: true,
          totalDeposited: true,
          warningCount: true,
          isSuspended: true,
        },
      });

      await logAdminAction(tx, req, {
        actorId,
        targetType: 'USER',
        targetId: userId,
        targetUserId: userId,
        action: 'USER_ROLE_UPDATE',
        reason,
        metadata: {
          fromRole: existing.role,
          toRole: role,
        },
      });

      if (userId !== actorId) {
        await tx.notification.create({
          data: {
            userId,
            type: 'SYSTEM',
            title: 'Role updated',
            message: `Your account role has been updated to ${role}.`,
            link: '/profile',
            metadata: { role },
          },
        });
      }

      return user;
    });

    return res.json({ message: 'User role updated.', user: updated });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    console.error('admin.updateUserRole error:', error);
    return res.status(500).json({ error: 'Server error while updating user role.' });
  }
};

const listTags = async (req, res) => {
  try {
    const limit = clamp(toInt(req.query?.limit) || 200, 1, 500);
    const status = normalize(req.query?.status).toUpperCase();
    const creatorId = normalize(req.query?.creatorId);

    const tags = await prisma.tag.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(creatorId ? { createdById: creatorId } : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { comics: true } },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return res.json(tags);
  } catch (error) {
    console.error('admin.listTags error:', error);
    return res.status(500).json({ error: 'Server error while fetching tags.' });
  }
};

const updateTag = async (req, res) => {
  try {
    const actorId = req.user?.userId;
    const tagId = normalize(req.params?.id);
    const status = normalize(req.body?.status).toUpperCase();
    const isOfficial = req.body?.isOfficial;
    const description = req.body?.description;
    const name = normalize(req.body?.name);
    const reason = normalize(req.body?.reason) || null;

    if (!actorId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!tagId) return res.status(400).json({ error: 'Tag id is required.' });

    const payload = {};
    if (status) {
      if (!['ACTIVE', 'HIDDEN'].includes(status)) {
        return res.status(400).json({ error: 'status must be ACTIVE/HIDDEN.' });
      }
      payload.status = status;
    }

    if (typeof isOfficial === 'boolean') payload.isOfficial = isOfficial;
    if (description !== undefined) payload.description = normalize(description) || null;
    if (name) payload.name = name;

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No field to update.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.tag.findUnique({ where: { id: tagId } });
      if (!existing) throw new Error('TAG_NOT_FOUND');

      if (name && name !== existing.name) {
        const duplicated = await tx.tag.findUnique({ where: { name } });
        if (duplicated && duplicated.id !== tagId) throw new Error('TAG_DUPLICATED');
      }

      const tag = await tx.tag.update({
        where: { id: tagId },
        data: payload,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { comics: true } },
        },
      });

      await logAdminAction(tx, req, {
        actorId,
        targetType: 'TAG',
        targetId: tagId,
        targetUserId: existing.createdById || null,
        action: 'TAG_UPDATE',
        reason,
        metadata: payload,
      });

      if (existing.createdById && existing.createdById !== actorId) {
        await tx.notification.create({
          data: {
            userId: existing.createdById,
            type: 'MODERATION',
            title: 'Your tag was updated by admin',
            message: `Tag "${existing.name}" has been updated by admin moderation.`,
            link: '/author',
            metadata: {
              tagId,
              updates: payload,
            },
          },
        });
      }

      return tag;
    });

    return res.json({ message: 'Tag updated.', tag: updated });
  } catch (error) {
    if (error.message === 'TAG_NOT_FOUND') {
      return res.status(404).json({ error: 'Tag not found.' });
    }

    if (error.message === 'TAG_DUPLICATED') {
      return res.status(409).json({ error: 'Tag name already exists.' });
    }

    console.error('admin.updateTag error:', error);
    return res.status(500).json({ error: 'Server error while updating tag.' });
  }
};

module.exports = {
  getOverview,
  listAuthors,
  listComics,
  moderateComic,
  listComments,
  moderateComment,
  listUsers,
  getUserHistory,
  updateUserStatus,
  updateUserRole,
  listTags,
  updateTag,
};
