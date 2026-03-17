const prisma = require('../config/db');

// ==========================================
// 1. [POST] Thêm chương mới (Dành cho Tác giả)
// ==========================================
const createChapter = async (req, res) => {
  try {
    const { comicId, title, orderNumber, price, images } = req.body;

    // KIỂM TRA DỮ LIỆU ẢNH: Ngăn chặn tạo chương rỗng
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Chương truyện phải có ít nhất 1 ảnh!' });
    }

    // TÌM THÔNG TIN TRUYỆN ĐỂ TẠO THÔNG BÁO
    const comic = await prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic) return res.status(404).json({ error: 'Không tìm thấy bộ truyện gốc' });
    const existing = await prisma.chapter.findFirst({
      where: {
        comicId,
        orderNumber
      }
    });

    if (existing) {
      return res.status(400).json({
        error: "Chương này đã tồn tại (trùng orderNumber)"
      });
    }

    const newChapter = await prisma.chapter.create({
      data: {
        comicId,
        title,
        orderNumber,
        price: price || 0,
        images: {
          create: images.map((url, index) => ({ url, pageNumber: index + 1 }))
        }
      },
      include: { images: true }
    });

    // --- LOGIC THÔNG BÁO ---
    const favorites = await prisma.favorite.findMany({
      where: { comicId },
      select: { userId: true }
    });

    if (favorites.length > 0) {
      const notificationsData = favorites.map(fav => ({
        userId: fav.userId,
        title: 'Chương mới phát hành! 🎉',
        message: `Truyện "${comic.title}" vừa cập nhật ${title}. Vào đọc ngay!`, // Biến comic.title giờ đã an toàn
        link: `/read/${newChapter.id}`
      }));

      await prisma.notification.createMany({
        data: notificationsData
      });
    }

    res.status(201).json({ message: 'Thêm chương thành công!', chapter: newChapter });
  } catch (error) {
    console.error("Lỗi tạo chương:", error);
    res.status(500).json({ error: 'Lỗi server khi tạo chương' });
  }
};



// ==========================================
// 2. [GET] Lấy danh sách chương của một bộ truyện
// ==========================================
const getChaptersByComic = async (req, res) => {
  try {
    const { comicId } = req.params;

    console.log("📌 Fetch chapters for comic:", comicId);

    // 1️⃣ Kiểm tra comic có tồn tại không
    const comic = await prisma.comic.findUnique({
      where: { id: comicId }
    });

    if (!comic) {
      return res.status(404).json({
        error: "Không tìm thấy truyện",
        comicId
      });
    }

    // 2️⃣ Lấy danh sách chapter
    const chapters = await prisma.chapter.findMany({
      where: {
        comicId,
        status: "PUBLISHED" // chỉ lấy chương hiển thị
      },
      orderBy: { orderNumber: "asc" },
      select: {
        id: true,
        title: true,
        orderNumber: true,
        price: true,
        createdAt: true
      }
    });

    res.status(200).json(chapters);

  } catch (error) {
    console.error("❌ Lỗi lấy chapter:", error);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách chương" });
  }
};

// ==========================================
// 3. [GET] ĐỌC TRUYỆN: Lấy nội dung chi tiết & ảnh (CÓ KIỂM TRA QUYỀN)
// ==========================================
const getChapterDetail = async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID của chương từ URL

    // 1. Tìm chương và lấy kèm toàn bộ hình ảnh, sắp xếp theo số trang
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        comic: true,
        images: { orderBy: { pageNumber: 'asc' } }
      }
    });

    if (!chapter) return res.status(404).json({ error: 'Không tìm thấy chương này!' });

    // 2. NẾU MIỄN PHÍ -> Trả về ảnh luôn, không cần check Token
    if (chapter.price === 0) {
      return res.json({ message: 'Đọc truyện vui vẻ!', chapter, images: chapter.images });
    }

    // ==========================================
    // TỪ ĐÂY TRỞ XUỐNG LÀ XỬ LÝ CHƯƠNG CÓ PHÍ
    // ==========================================

    // 3. Kiểm tra xem user có đăng nhập không? (Biến req.user lấy từ optionalAuth)
    if (!req.user) {
      return res.status(403).json({ error: 'Đây là chương trả phí (VIP). Vui lòng đăng nhập để đọc!' });
    }

    // 4. Kiểm tra quyền ưu tiên: Tác giả của truyện đó hoặc Admin thì được xem free
    const isAuthor = (req.user.role === 'AUTHOR' && chapter.comic.authorId === req.user.userId);
    const isAdmin = (req.user.role === 'ADMIN');

    if (isAuthor || isAdmin) {
      return res.json({ message: 'Quyền Tác giả/Admin', chapter, images: chapter.images });
    }

    // 5. Kiểm tra lịch sử mua hàng của Độc giả bình thường
    const hasBought = await prisma.unlockedChapter.findUnique({
      where: {
        userId_chapterId: { userId: req.user.userId, chapterId: id }
      }
    });

    if (hasBought) {
      return res.json({ message: 'Bạn đã mua chương này. Đọc truyện vui vẻ!', chapter, images: chapter.images });
    }

    // Nếu lọt xuống tận đây có nghĩa là: Có đăng nhập, không phải tác giả, và CHƯA MUA -> Chặn!
    return res.status(403).json({ error: 'Bạn chưa mua chương này. Vui lòng thanh toán để xem ảnh!' });

  } catch (error) {
    console.error("Lỗi đọc chương:", error);
    res.status(500).json({ error: 'Lỗi server khi load nội dung chương' });
  }
};

// Đảm bảo export đầy đủ 3 hàm ra ngoài
module.exports = { createChapter, getChaptersByComic, getChapterDetail };