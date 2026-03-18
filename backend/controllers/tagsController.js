const prisma = require('../config/db');

const normalizeName = (value) => (typeof value === 'string' ? value.trim() : '');

const getAllTags = async (req, res) => {
  try {
    const includeHidden = req.user && (req.user.role === 'ADMIN' || req.user.role === 'AUTHOR') && req.query?.includeHidden === 'true';
    const where = includeHidden ? {} : { status: 'ACTIVE' };
    const tags = await prisma.tag.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true, role: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json(tags);
  } catch (error) {
    console.error('getAllTags error:', error);
    return res.status(500).json({ error: 'Server error while fetching tags.' });
  }
};

const getMyTags = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const tags = await prisma.tag.findMany({
      where: { createdById: userId },
      orderBy: { name: 'asc' },
    });

    return res.json(tags);
  } catch (error) {
    console.error('getMyTags error:', error);
    return res.status(500).json({ error: 'Server error while fetching your tags.' });
  }
};

const createTag = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!['AUTHOR', 'ADMIN'].includes(role)) {
      return res.status(403).json({ error: 'Only author/admin can create tags.' });
    }

    const name = normalizeName(req.body?.name);
    const description = normalizeName(req.body?.description) || null;

    if (!name) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const existingTag = await prisma.tag.findUnique({ where: { name } });
    if (existingTag) {
      return res.status(409).json({ error: 'Tag already exists.' });
    }

    const newTag = await prisma.tag.create({
      data: {
        name,
        description,
        createdById: userId,
        isOfficial: role === 'ADMIN',
      },
    });

    return res.status(201).json({ message: 'Tag created.', tag: newTag });
  } catch (error) {
    console.error('createTag error:', error);
    return res.status(500).json({ error: 'Server error while creating tag.' });
  }
};

const updateTag = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const id = normalizeName(req.params?.id);

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!id) return res.status(400).json({ error: 'Tag id is required.' });

    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Tag not found.' });

    const isAdmin = role === 'ADMIN';
    const isOwner = existing.createdById === userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You can only update your own tags.' });
    }

    const payload = {};
    const name = normalizeName(req.body?.name);
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : undefined;
    const status = normalizeName(req.body?.status);

    if (name && name !== existing.name) {
      const duplicated = await prisma.tag.findUnique({ where: { name } });
      if (duplicated && duplicated.id !== id) {
        return res.status(409).json({ error: 'Tag name already exists.' });
      }
      payload.name = name;
    }

    if (description !== undefined) payload.description = description || null;
    if (status) {
      if (!['ACTIVE', 'HIDDEN'].includes(status)) {
        return res.status(400).json({ error: 'status must be ACTIVE or HIDDEN.' });
      }
      payload.status = status;
    }

    if (typeof req.body?.isOfficial === 'boolean' && isAdmin) {
      payload.isOfficial = req.body.isOfficial;
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: payload,
    });

    return res.json({ message: 'Tag updated.', tag: updated });
  } catch (error) {
    console.error('updateTag error:', error);
    return res.status(500).json({ error: 'Server error while updating tag.' });
  }
};

const deleteTag = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    const id = normalizeName(req.params?.id);

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!id) return res.status(400).json({ error: 'Tag id is required.' });

    const existing = await prisma.tag.findUnique({
      where: { id },
      include: { comics: { select: { id: true } } },
    });

    if (!existing) return res.status(404).json({ error: 'Tag not found.' });

    const isAdmin = role === 'ADMIN';
    const isOwner = existing.createdById === userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You can only delete your own tags.' });
    }

    if (existing.comics.length > 0 && !isAdmin) {
      return res.status(400).json({ error: 'Tag is being used by comics. Only admin can remove it.' });
    }

    await prisma.tag.delete({ where: { id } });
    return res.json({ message: 'Tag deleted.' });
  } catch (error) {
    console.error('deleteTag error:', error);
    return res.status(500).json({ error: 'Server error while deleting tag.' });
  }
};

module.exports = { getAllTags, getMyTags, createTag, updateTag, deleteTag };
