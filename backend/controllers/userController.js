const prisma = require('../config/db');

// [GET] Lấy thông tin cá nhân của người đang đăng nhập
const getMe = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Tìm user trong DB, nhưng KHÔNG lấy passwordHash để bảo mật
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        points: true,
        avatar: true,
        createdAt: true
      }
    });

    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng!' });

    res.json(user);
  } catch (error) {
    console.error("Lỗi lấy thông tin user:", error);
    res.status(500).json({ error: 'Lỗi server khi lấy thông tin người dùng' });
  }
};

// [GET] Lấy danh sách các chương truyện người dùng ĐÃ MUA
const getMyUnlockedChapters = async (req, res) => {
  try {
    const userId = req.user.userId;

    const unlocked = await prisma.unlockedChapter.findMany({
      where: { userId: userId },
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            orderNumber: true,
            comic: {
              select: { id: true, title: true, coverUrl: true } // Lấy kèm tên và ảnh bìa truyện
            }
          }
        }
      },
      orderBy: { unlockedAt: 'desc' } // Mua mới nhất xếp lên đầu
    });

    // Format lại dữ liệu cho đẹp mắt trước khi gửi về Frontend
    const formattedData = unlocked.map(item => ({
      unlockedAt: item.unlockedAt,
      chapterId: item.chapter.id,
      chapterTitle: item.chapter.title,
      comicId: item.chapter.comic.id,
      comicTitle: item.chapter.comic.title,
      comicCover: item.chapter.comic.coverUrl
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("Lỗi lấy lịch sử mua truyện:", error);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử mua truyện' });
  }
};

// [GET] Lấy danh sách truyện YÊU THÍCH
const getMyFavorites = async (req, res) => {
  try {
    const userId = req.user.userId;
    const favorites = await prisma.favorite.findMany({
      where: { userId: userId },
      include: {
        comic: {
          select: { id: true, title: true, coverUrl: true, author: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedData = favorites.map(item => ({
      id: item.id,
      comicId: item.comic.id,
      title: item.comic.title,
      coverUrl: item.comic.coverUrl,
      authorName: item.comic.author?.name
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("Lỗi lấy danh sách yêu thích:", error);
    res.status(500).json({ error: 'Lỗi server khi lấy truyện yêu thích' });
  }
};

const getMyHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const history = await prisma.readingHistory.findMany({
      where: { userId },
      include: {
        comic: true, // Quan trọng: Phải lấy comic để Frontend có ảnh bìa/tên
        chapter: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy lịch sử đọc' });
  }
};

module.exports = { getMe, getMyUnlockedChapters, getMyFavorites, getMyHistory };