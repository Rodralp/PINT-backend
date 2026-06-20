import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export const checkToken = (req, res, next) => {
  if (!JWT_SECRET) {
    return res.status(500).json({ message: 'JWT_SECRET not configured.' });
  }

  const authHeader = req.headers['x-access-token'] || req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token invalido ou ausente.' });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalido ou ausente.' });
  }
};
