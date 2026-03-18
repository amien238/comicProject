const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_tam_thoi';
const REGISTERABLE_ROLES = new Set(['USER', 'AUTHOR']);
const SOCIAL_PROVIDERS = new Set(['google', 'facebook', 'apple']);

const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body || {};

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required.' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(name).trim();

    if (!normalizedEmail || !normalizedName) {
      return res.status(400).json({ error: 'Invalid email or name.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const safeRole = REGISTERABLE_ROLES.has(role) ? role : 'USER';

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedName,
        passwordHash,
        role: safeRole,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        points: true,
        totalDeposited: true,
        avatar: true,
      },
    });

    return res.status(201).json({ message: 'Register success.', user: newUser });
  } catch (error) {
    console.error('register error:', error);
    return res.status(500).json({ error: 'Server error while registering.' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Login success.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        points: user.points,
        totalDeposited: user.totalDeposited,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('login error:', error);
    return res.status(500).json({ error: 'Server error while logging in.' });
  }
};

const socialAuth = async (req, res) => {
  try {
    const { provider, email, name, avatar } = req.body || {};

    if (!SOCIAL_PROVIDERS.has(provider)) {
      return res.status(400).json({ error: 'Unsupported social provider.' });
    }

    if (!email || !name) {
      return res.status(400).json({ error: 'email and name are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(name).trim();
    const normalizedAvatar = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : null;

    if (!normalizedEmail || !normalizedName) {
      return res.status(400).json({ error: 'Invalid email or name.' });
    }

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedName,
          avatar: normalizedAvatar,
          role: 'USER',
        },
      });
    } else if (!user.avatar && normalizedAvatar) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatar: normalizedAvatar },
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: `Social login success (${provider}).`,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        points: user.points,
        totalDeposited: user.totalDeposited,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('socialAuth error:', error);
    return res.status(500).json({ error: 'Server error while social login.' });
  }
};

module.exports = { register, login, socialAuth };
