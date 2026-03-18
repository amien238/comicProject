const prisma = require('../config/db');

const STATUS_VALUES = new Set(['PUBLISHED', 'HIDDEN', 'ARCHIVED']);

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');

const canManageComic = (reqUser, comic) => {
  if (!reqUser || !comic) return false;
  if (reqUser.role === 'ADMIN') return true;
  return comic.authorId === reqUser.userId;
};

const mapComicPayload = (comic) => ({
  ...comic,
  chapterCount: comic._count?.chapters || 0,
  favoriteCount: comic._count?.favorites || 0,
  commentCount: comic._count?.comments || 0,
  ratingCount: comic._count?.ratings || 0,
});

const getAllComics = async (req, res) => {
  try {
    const search = normalize(req.query.search);
    const includeHidden = req.user && ['ADMIN', 'AUTHOR'].includes(req.user.role) && req.query.includeHidden === 'true';
    const authorOnly = req.user && req.query.authorOnly === 'true';
    const statusQuery = normalize(req.query.status).toUpperCase();
    const statusFilter = STATUS_VALUES.has(statusQuery) ? statusQuery : null;

    const where = {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { author: { name: { contains: search, mode: 'insensitive' } } },
              { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    if (!includeHidden) {
      where.status = 'PUBLISHED';
    } else if (statusFilter) {
      where.status = statusFilter;
    }

    if (authorOnly && req.user?.userId) {
      where.authorId = req.user.userId;
    }

    const comics = await prisma.comic.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        tags: true,
        _count: { select: { chapters: true, favorites: true, comments: true, ratings: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(comics.map(mapComicPayload));
  } catch (error) {
    console.error('getAllComics error:', error);
    return res.status(500).json({ error: 'Server error while fetching comics.' });
  }
};

const getComicById = async (req, res) => {
  try {
    const { id } = req.params;
    const comic = await prisma.comic.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        tags: true,
        _count: { select: { chapters: true, comments: true, favorites: true, ratings: true } },
      },
    });

    if (!comic) {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    if (comic.status !== 'PUBLISHED' && !canManageComic(req.user, comic)) {
      return res.status(404).json({ error: 'Comic not found.' });
    }

    return res.json(mapComicPayload(comic));
  } catch (error) {
    console.error('getComicById error:', error);
    return res.status(500).json({ error: 'Server error while fetching comic detail.' });
  }
};

const getMyComics = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const comics = await prisma.comic.findMany({
      where: { authorId: userId },
      include: {
        tags: true,
        _count: { select: { chapters: true, favorites: true, comments: true, ratings: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(comics.map(mapComicPayload));
  } catch (error) {
    console.error('getMyComics error:', error);
    return res.status(500).json({ error: 'Server error while fetching your comics.' });
  }
};

const createComic = async (req, res) => {
  try {
    const authorId = req.user?.userId;
    if (!authorId) return res.status(401).json({ error: 'Unauthorized.' });

    const title = normalize(req.body?.title);
    const description = normalize(req.body?.description);
    const coverUrl = normalize(req.body?.coverUrl);
    const statusInput = normalize(req.body?.status).toUpperCase();
    const hiddenReason = normalize(req.body?.hiddenReason) || null;
    const tagIds = Array.isArray(req.body?.tagIds) ? req.body.tagIds : [];

    if (!title || !description || !coverUrl) {
      return res.status(400).json({ error: 'title, description, and coverUrl are required.' });
    }

    const normalizedTagIds = [...new Set(tagIds.map((id) => normalize(id)).filter(Boolean))];
    if (normalizedTagIds.length > 0) {
      const tagCount = await prisma.tag.count({ where: { id: { in: normalizedTagIds }, status: 'ACTIVE' } });
      if (tagCount !== normalizedTagIds.length) {
        return res.status(400).json({ error: 'One or more tags are invalid or hidden.' });
      }
    }

    const status = STATUS_VALUES.has(statusInput) ? statusInput : 'PUBLISHED';

    const comic = await prisma.comic.create({
      data: {
        authorId,
        title,
        description,
        coverUrl,
        status,
        hiddenReason: status !== 'PUBLISHED' ? hiddenReason : null,
        ...(normalizedTagIds.length > 0
          ? {
              tags: {
                connect: normalizedTagIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: {
        author: { select: { id: true, name: true } },
        tags: true,
        _count: { select: { chapters: true, favorites: true, comments: true, ratings: true } },
      },
    });

    return res.status(201).json({ message: 'Comic created successfully.', comic: mapComicPayload(comic) });
  } catch (error) {
    console.error('createComic error:', error);
    return res.status(500).json({ error: 'Server error while creating comic.' });
  }
};

const updateComic = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    const existing = await prisma.comic.findUnique({ where: { id }, select: { id: true, authorId: true } });
    if (!existing) return res.status(404).json({ error: 'Comic not found.' });

    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existing.authorId === userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You can only edit your own comic.' });
    }

    const payload = {};

    const title = normalize(req.body?.title);
    const description = normalize(req.body?.description);
    const coverUrl = normalize(req.body?.coverUrl);
    const status = normalize(req.body?.status).toUpperCase();
    const hiddenReason = typeof req.body?.hiddenReason === 'string' ? req.body.hiddenReason.trim() : undefined;
    const violationNote = typeof req.body?.violationNote === 'string' ? req.body.violationNote.trim() : undefined;

    if (title) payload.title = title;
    if (description) payload.description = description;
    if (coverUrl) payload.coverUrl = coverUrl;

    if (status) {
      if (!STATUS_VALUES.has(status)) {
        return res.status(400).json({ error: 'status must be PUBLISHED/HIDDEN/ARCHIVED.' });
      }
      payload.status = status;
      if (status === 'PUBLISHED') {
        payload.hiddenReason = null;
      } else if (hiddenReason !== undefined) {
        payload.hiddenReason = hiddenReason || null;
      }
    } else if (hiddenReason !== undefined) {
      payload.hiddenReason = hiddenReason || null;
    }

    if (violationNote !== undefined && isAdmin) {
      payload.violationNote = violationNote || null;
    }

    if (Array.isArray(req.body?.tagIds)) {
      const normalizedTagIds = [...new Set(req.body.tagIds.map((item) => normalize(item)).filter(Boolean))];
      if (normalizedTagIds.length > 0) {
        const tagCount = await prisma.tag.count({ where: { id: { in: normalizedTagIds }, status: 'ACTIVE' } });
        if (tagCount !== normalizedTagIds.length) {
          return res.status(400).json({ error: 'One or more tags are invalid or hidden.' });
        }
      }

      payload.tags = {
        set: normalizedTagIds.map((tagId) => ({ id: tagId })),
      };
    }

    const updated = await prisma.comic.update({
      where: { id },
      data: payload,
      include: {
        author: { select: { id: true, name: true } },
        tags: true,
        _count: { select: { chapters: true, favorites: true, comments: true, ratings: true } },
      },
    });

    return res.json({ message: 'Comic updated.', comic: mapComicPayload(updated) });
  } catch (error) {
    console.error('updateComic error:', error);
    return res.status(500).json({ error: 'Server error while updating comic.' });
  }
};

const deleteComic = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    const comic = await prisma.comic.findUnique({ where: { id }, select: { id: true, authorId: true } });
    if (!comic) return res.status(404).json({ error: 'Comic not found.' });

    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = comic.authorId === userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You can only delete your own comic.' });
    }

    await prisma.comic.delete({ where: { id } });
    return res.json({ message: 'Comic deleted.' });
  } catch (error) {
    console.error('deleteComic error:', error);
    return res.status(500).json({ error: 'Server error while deleting comic.' });
  }
};

module.exports = { getAllComics, getComicById, getMyComics, createComic, updateComic, deleteComic };
