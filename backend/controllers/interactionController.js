// ... giữ nguyên các hàm incrementView, rateComic, toggleFavorite ...
const prisma = require('../config/db');

const incrementView = async (req, res) => {
  const { comicId } = req.params;
  try {
    const updatedComic = await prisma.comic.update({
      where: { id: comicId },
      data: { views: { increment: 1 } }
    });
    res.json({ message: 'Tăng lượt xem thành công', views: updatedComic.views });
  } catch (error) { res.status(500).json({ error: 'Lỗi server khi cập nhật lượt xem' }); }
};

const rateComic = async (req, res) => {
  const { comicId, score, review } = req.body;
  const userId = req.user.userId;
  if (score < 1 || score > 5) return res.status(400).json({ error: 'Điểm đánh giá phải từ 1 đến 5 sao' });
  try {
    await prisma.rating.upsert({
      where: { userId_comicId: { userId, comicId } },
      update: { score, review },
      create: { userId, comicId, score, review }
    });
    const aggregations = await prisma.rating.aggregate({ where: { comicId }, _avg: { score: true } });
    const newAverage = aggregations._avg.score || 0;
    await prisma.comic.update({ where: { id: comicId }, data: { averageRating: parseFloat(newAverage.toFixed(1)) } });
    res.json({ message: 'Đánh giá thành công!', averageRating: newAverage.toFixed(1) });
  } catch (error) { res.status(500).json({ error: 'Lỗi server khi đánh giá truyện' }); }
};

const toggleFavorite = async (req, res) => {
  const { comicId } = req.body;
  const userId = req.user.userId;
  try {
    const existingFavorite = await prisma.favorite.findUnique({ where: { userId_comicId: { userId, comicId } } });
    if (existingFavorite) {
      await prisma.favorite.delete({ where: { id: existingFavorite.id } });
      res.json({ message: 'Đã bỏ yêu thích', isFavorite: false });
    } else {
      await prisma.favorite.create({ data: { userId, comicId } });
      res.json({ message: 'Đã thêm vào danh sách yêu thích', isFavorite: true });
    }
  } catch (error) { res.status(500).json({ error: 'Lỗi server khi xử lý yêu thích' }); }
};

// ----------------------------------------------------
// [POST] Thêm Bình luận có hỗ trợ Trả lời (Reply)
// ----------------------------------------------------
const addComment = async (req, res) => {
  const { comicId, chapterId, parentId, content } = req.body; // Thêm parentId
  const userId = req.user.userId;

  try {
    if (!content || content.trim() === '') return res.status(400).json({ error: 'Nội dung không được để trống' });

    const comment = await prisma.comment.create({
      data: { comicId, chapterId, parentId, userId, content },
      include: { 
        // Bắt buộc lấy role và totalDeposited để tính Cấp Bậc trên giao diện
        user: { select: { name: true, avatar: true, role: true, totalDeposited: true } } 
      }
    });

    res.status(201).json({ message: 'Bình luận thành công', comment });
  } catch (error) {
    console.error("Lỗi bình luận:", error);
    res.status(500).json({ error: 'Lỗi server khi gửi bình luận' });
  }
};

// ----------------------------------------------------
// [GET] Lấy danh sách Bình luận ĐA TẦNG
// ----------------------------------------------------
const getComments = async (req, res) => {
  const { comicId } = req.params;
  try {
    // Chỉ lấy comment GỐC (parentId = null), sau đó lôi thêm các lượt trả lời (replies) của nó theo kèm
    const comments = await prisma.comment.findMany({
      where: { comicId, parentId: null },
      include: { 
        user: { select: { name: true, avatar: true, role: true, totalDeposited: true } },
        replies: {
          include: { user: { select: { name: true, avatar: true, role: true, totalDeposited: true } } },
          orderBy: { createdAt: 'asc' } // Lời giải đáp cũ hơn thì xếp trước
        }
      },
      orderBy: { createdAt: 'desc' } // Comment gốc mới nhất thì xếp trên cùng
    });
    res.json(comments);
  } catch (error) {
    console.error("Lỗi lấy bình luận:", error);
    res.status(500).json({ error: 'Lỗi server khi lấy bình luận' });
  }
};

module.exports = { incrementView, rateComic, addComment, toggleFavorite, getComments };