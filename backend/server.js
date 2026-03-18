require('dotenv').config();

const express = require('express');
const cors = require('cors');
const passport = require('passport');

const prisma = require('./config/db');
const { setupOAuthStrategies } = require('./config/oauth');

const authRoutes = require('./routes/authRoutes');
const comicRoutes = require('./routes/comicsRoutes');
const chapterRoutes = require('./routes/chapterRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const tagsRoutes = require('./routes/tagsRoutes');
const aiRoutes = require('./routes/aiRoutes');
const historyRoutes = require('./routes/historyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

setupOAuthStrategies();
app.use(passport.initialize());

app.get('/', (_req, res) => {
  res.send('AmienComic backend is running.');
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy.' });
});

app.get('/api/test-db', async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ message: 'Database connected.', userCount });
  } catch (error) {
    console.error('test-db error:', error);
    res.status(500).json({ error: 'Cannot connect to database.', details: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/comics', comicRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
