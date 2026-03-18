const prisma = require('../config/db');

const getAllComics = async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const comics = await prisma.comic.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { author: { name: { contains: search, mode: 'insensitive' } } },
              { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : undefined,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        tags: true,
        _count: { select: { chapters: true, favorites: true, comments: true, ratings: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const payload = comics.map((comic) => {
      const counts = comic._count;
      return {
        ...comic,
        chapterCount: counts.chapters,
        favoriteCount: counts.favorites,
        commentCount: counts.comments,
        ratingCount: counts.ratings,
      };
    });

    return res.json(payload);
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

    return res.json({
      ...comic,
      chapterCount: comic._count.chapters,
      commentCount: comic._count.comments,
      favoriteCount: comic._count.favorites,
      ratingCount: comic._count.ratings,
    });
  } catch (error) {
    console.error('getComicById error:', error);
    return res.status(500).json({ error: 'Server error while fetching comic detail.' });
  }
};

const createComic = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { title, description, coverUrl, tagIds } = req.body || {};
    const authorId = req.user.userId;

    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';
    const normalizedCover = typeof coverUrl === 'string' ? coverUrl.trim() : '';

    if (!normalizedTitle || !normalizedDescription || !normalizedCover) {
      return res.status(400).json({ error: 'title, description, and coverUrl are required.' });
    }

    const normalizedTagIds = Array.isArray(tagIds)
      ? [...new Set(tagIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    if (normalizedTagIds.length > 0) {
      const tagCount = await prisma.tag.count({ where: { id: { in: normalizedTagIds } } });
      if (tagCount !== normalizedTagIds.length) {
        return res.status(400).json({ error: 'One or more tags are invalid.' });
      }
    }

    const newComic = await prisma.comic.create({
      data: {
        title: normalizedTitle,
        description: normalizedDescription,
        coverUrl: normalizedCover,
        authorId,
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
      },
    });

    return res.status(201).json({ message: 'Comic created successfully.', comic: newComic });
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
    const { title, description, coverUrl, tagIds } = req.body || {};

    const comic = await prisma.comic.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });

    if (!comic) return res.status(404).json({ error: 'Comic not found.' });

    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = comic.authorId === userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You can only edit your own comic.' });
    }

    const payload = {};

    if (typeof title === 'string' && title.trim()) payload.title = title.trim();
    if (typeof description === 'string' && description.trim()) payload.description = description.trim();
    if (typeof coverUrl === 'string' && coverUrl.trim()) payload.coverUrl = coverUrl.trim();

    if (Array.isArray(tagIds)) {
      const normalizedTagIds = [...new Set(tagIds.map((item) => String(item).trim()).filter(Boolean))];
      if (normalizedTagIds.length > 0) {
        const tagCount = await prisma.tag.count({ where: { id: { in: normalizedTagIds } } });
        if (tagCount !== normalizedTagIds.length) {
          return res.status(400).json({ error: 'One or more tags are invalid.' });
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
      },
    });

    return res.json({ message: 'Comic updated.', comic: updated });
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
    const comic = await prisma.comic.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });

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

module.exports = { getAllComics, getComicById, createComic, updateComic, deleteComic };
