const prisma = require('../config/db');

// [GET] Lấy danh sách tất cả các Tags (Để hiển thị ra giao diện cho người dùng chọn)
const getAllTags = async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(tags);
  } catch (error) {
    console.error("Lỗi lấy danh sách tags:", error);
    res.status(500).json({ error: 'Lỗi server khi lấy tags' });
  }
};

// [POST] Tạo Tag mới (Dành cho Admin/Hệ thống)
const createTag = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Tên Tag không được để trống' });

    const newTag = await prisma.tag.create({
      data: { name, description }
    });

    res.status(201).json({ message: 'Tạo Tag thành công', tag: newTag });
  } catch (error) {
    console.error("Lỗi tạo tag:", error);
    res.status(500).json({ error: 'Tag này có thể đã tồn tại hoặc có lỗi server' });
  }
};

module.exports = { getAllTags, createTag };