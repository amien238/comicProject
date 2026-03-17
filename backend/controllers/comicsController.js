const prisma = require('../config/db');

// ==========================================
// [GET] Lấy danh sách tất cả truyện
// ==========================================
const getAllComics = async (req, res) => {
  try {
    const comics = await prisma.comic.findMany({
      include: {
        author: { select: { name: true } },
        tags: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(comics);
  } catch (error) {
    console.error("Lỗi lấy danh sách truyện:", error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách truyện' });
  }
};


// ==========================================
// [GET] Lấy chi tiết 1 truyện theo ID
// ==========================================
const getComicById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("📚 Fetch comic:", id);

    const comic = await prisma.comic.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true
          }
        },
        tags: true
      }
    });

    if (!comic) {
      return res.status(404).json({
        error: "Không tìm thấy truyện",
        id
      });
    }

    res.json(comic);

  } catch (error) {
    console.error("Lỗi lấy chi tiết truyện:", error);
    res.status(500).json({ error: "Lỗi server khi lấy chi tiết truyện" });
  }
};


// ==========================================
// [POST] Tạo truyện mới
// ==========================================
const createComic = async (req, res) => {
  try {
    const { title, description, coverUrl, tagIds } = req.body;
    const authorId = req.user.userId;

    const newComic = await prisma.comic.create({
      data: {
        title,
        description,
        coverUrl,
        authorId,
        ...(tagIds && tagIds.length > 0
          ? {
              tags: {
                connect: tagIds.map(id => ({ id }))
              }
            }
          : {})
      },
      include: { tags: true }
    });

    res.status(201).json({
      message: "Tạo truyện thành công!",
      comic: newComic
    });

  } catch (error) {
    console.error("Lỗi tạo truyện:", error);
    res.status(500).json({ error: "Lỗi server khi tạo truyện" });
  }
};


module.exports = {
  getAllComics,
  getComicById,
  createComic
};