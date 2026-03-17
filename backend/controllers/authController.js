const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db'); // Gọi DB đã cấu hình

const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email này đã được sử dụng!' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { email, name, passwordHash: hashedPassword, role: role || 'USER', points: 0 }
    });

    res.status(201).json({ message: 'Đăng ký thành công!', user: { id: newUser.id, email: newUser.email, name: newUser.name } });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi đăng ký' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Email hoặc mật khẩu không đúng!' });

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return res.status(400).json({ error: 'Email hoặc mật khẩu không đúng!' });

    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      process.env.JWT_SECRET || 'secret_tam_thoi', 
      { expiresIn: '7d' } 
    );

    res.json({ message: 'Đăng nhập thành công!', token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi đăng nhập' });
  }
};

module.exports = { register, login };