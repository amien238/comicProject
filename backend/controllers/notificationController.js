const prisma = require('../config/db');

const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json(notifications);
  } catch (error) {
    console.error('getMyNotifications error:', error);
    return res.status(500).json({ error: 'Server error while fetching notifications.' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.body || {};

    if (typeof id === 'string' && id.trim()) {
      const updated = await prisma.notification.updateMany({
        where: { id: id.trim(), userId },
        data: { isRead: true },
      });

      return res.json({ message: 'Notification marked as read.', updated: updated.count });
    }

    const updated = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return res.json({ message: 'All notifications marked as read.', updated: updated.count });
  } catch (error) {
    console.error('markAsRead error:', error);
    return res.status(500).json({ error: 'Server error while updating notifications.' });
  }
};

module.exports = { getMyNotifications, markAsRead };