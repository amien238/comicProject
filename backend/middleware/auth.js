const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_tam_thoi';

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
};

const protect = (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please login first.' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or expired.' });
    }

    req.user = payload;
    return next();
  });
};

const isAuthor = (req, res, next) => {
  if (!req.user || (req.user.role !== 'AUTHOR' && req.user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Author or admin permission required.' });
  }

  return next();
};

const isAccounter = (req, res, next) => {
  if (!req.user || (req.user.role !== 'ACCOUNTER' && req.user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Accounter or admin permission required.' });
  }

  return next();
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin permission required.' });
  }

  return next();
};

const optionalAuth = (req, _res, next) => {
  const token = getBearerToken(req);
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (!err) req.user = payload;
    return next();
  });
};

module.exports = { protect, isAuthor, isAccounter, isAdmin, optionalAuth };
