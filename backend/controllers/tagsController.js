const prisma = require('../config/db');

const getAllTags = async (_req, res) => {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
    return res.json(tags);
  } catch (error) {
    console.error('getAllTags error:', error);
    return res.status(500).json({ error: 'Server error while fetching tags.' });
  }
};

const createTag = async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : null;

    if (!name) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const existingTag = await prisma.tag.findUnique({ where: { name } });
    if (existingTag) {
      return res.status(409).json({ error: 'Tag already exists.' });
    }

    const newTag = await prisma.tag.create({
      data: { name, description },
    });

    return res.status(201).json({ message: 'Tag created.', tag: newTag });
  } catch (error) {
    console.error('createTag error:', error);
    return res.status(500).json({ error: 'Server error while creating tag.' });
  }
};

module.exports = { getAllTags, createTag };