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
        _count: { select: { chapters: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const payload = comics.map((comic) => ({
      ...comic,
      chapterCount: comic._count.chapters,
      _count: undefined,
    }));

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
        _count: { select: { chapters: true, comments: true, favorites: true } },
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
      _count: undefined,
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

module.exports = { getAllComics, getComicById, createComic };