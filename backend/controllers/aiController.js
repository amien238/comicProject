const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = require('../config/db');

const toSafeHistory = (history) => {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => {
      const role = item?.role === 'user' ? 'user' : 'model';
      const text = item?.parts?.[0]?.text;
      if (typeof text !== 'string' || !text.trim()) return null;
      return { role, parts: [{ text: text.trim() }] };
    })
    .filter(Boolean)
    .slice(-20);
};

const chatWithBot = async (req, res) => {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing on server.' });
    }

    const userId = req.user?.userId;
    const safeHistory = toSafeHistory(req.body?.history || []);

    if (safeHistory.length === 0) {
      return res.status(400).json({ error: 'history is required.' });
    }

    const [allComics, userReadingHistory] = await Promise.all([
      prisma.comic.findMany({
        select: {
          title: true,
          description: true,
          tags: { select: { name: true } },
        },
        take: 200,
      }),
      userId
        ? prisma.readingHistory.findMany({
            where: { userId },
            include: {
              comic: { select: { title: true } },
              chapter: { select: { title: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
          })
        : [],
    ]);

    const comicCtx = allComics
      .map((comic) => {
        const tags = comic.tags.map((tag) => tag.name).join(', ') || 'No tags';
        const desc = (comic.description || '').slice(0, 80);
        return `- ${comic.title} [${tags}]: ${desc}`;
      })
      .join('\n');

    const historyCtx = userReadingHistory.length
      ? `User recent reads: ${userReadingHistory
          .map((item) => `${item.comic.title} (latest: ${item.chapter.title})`)
          .join(', ')}`
      : 'User has no reading history yet.';

    const systemInstruction = [
      'You are Amien Bot for a comic platform.',
      'Only answer questions related to comics on this platform.',
      'If user asks for recommendations, prioritize matching from reading history.',
      'Answer in Vietnamese, friendly and concise.',
      '',
      'Available comics:',
      comicCtx || '- No comic data yet.',
      '',
      historyCtx,
    ].join('\n');

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction,
    });

    const chat = model.startChat({
      history: safeHistory.slice(0, -1),
    });

    const lastMessage = safeHistory[safeHistory.length - 1]?.parts?.[0]?.text || '';
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;

    return res.json({ reply: response.text() });
  } catch (error) {
    console.error('chatWithBot error:', error);
    return res.status(500).json({ error: 'AI service is temporarily unavailable.' });
  }
};

module.exports = { chatWithBot };