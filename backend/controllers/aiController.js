const { GoogleGenerativeAI } = require("@google/generative-ai");
const prisma = require('../config/db');

/**
 * AI Controller: Trả lời dựa trên ngữ cảnh người dùng và dữ liệu truyện thật
 */
const chatWithBot = async (req, res) => {
  try {
    const { history } = req.body; 
    const userId = req.user?.userId; // Lấy từ authenticateToken hoặc optionalAuth

    const API_KEY = process.env.GEMINI_API_KEY; 
    if (!API_KEY) return res.status(500).json({ error: 'Server chưa có API Key' });

    // 1. TRUY XUẤT DỮ LIỆU ĐA LUỒNG TỪ DATABASE
    const [allComics, userReadingHistory] = await Promise.all([
      // Lấy danh sách truyện đang có
      prisma.comic.findMany({ 
        select: { title: true, description: true, tags: { select: { name: true } } } 
      }),
      // Lấy 5 truyện người dùng này đọc gần nhất (nếu đã đăng nhập)
      userId ? prisma.readingHistory.findMany({
        where: { userId },
        include: { comic: { select: { title: true } }, chapter: { select: { title: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5
      }) : []
    ]);

    // 2. CHUẨN BỊ NGỮ CẢNH (CONTEXT)
    const comicCtx = allComics.map(c => `- ${c.title} (${c.tags.map(t => t.name).join(', ')}): ${c.description.substring(0, 40)}...`).join('\n');
    
    const historyCtx = userReadingHistory.length > 0 
      ? `Người dùng này đang theo dõi: ${userReadingHistory.map(h => `${h.comic.title} (đến ${h.chapter.title})`).join(', ')}.`
      : "Người dùng chưa có lịch sử đọc hoặc chưa đăng nhập.";

    // 3. CẤU HÌNH GOOGLE AI
    const genAI = new GoogleGenerativeAI(API_KEY);
    const systemInstruction = `Bạn là Amien Bot - Trợ lý thông minh của AmienComic.
    
    DANH SÁCH TRUYỆN TRÊN WEB:
    ${comicCtx}
    
    LỊCH SỬ CỦA NGƯỜI ĐANG CHAT:
    ${historyCtx}

    NHIỆM VỤ:
    - Nếu họ hỏi gợi ý, hãy dựa vào lịch sử đọc của họ để tư vấn truyện cùng thể loại.
    - Trả lời thân thiện, xưng mình gọi bạn.
    - Tuyệt đối không trả lời về các chủ đề ngoài truyện tranh.
    - Nếu họ hỏi về nhân vật, hãy đối chiếu xem nhân vật đó có nằm trong mô tả các truyện trên không.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: systemInstruction,
    });

    const chat = model.startChat({
      history: history.slice(0, -1),
    });

    const lastMessage = history[history.length - 1].parts[0].text;
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    
    res.json({ reply: response.text() });

  } catch (error) {
    console.error("Lỗi AI Controller:", error.message);
    res.status(500).json({ error: 'Nexus Bot đang bận suy nghĩ, bạn thử lại sau nhé!' });
  }
};

module.exports = { chatWithBot };