import jwt from 'jsonwebtoken';

export const checkToken = (req, res, next) => {
  let token = req.headers['x-access-token'] || req.headers['authorization'];

  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7, token.length);
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token indisponivel.',
    });
  }

  const jwtSecret = process.env.JWT_SECRET;

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: 'O token nao e valido.',
      });
    }

    req.decoded = decoded;
    next();
  });
};
