const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Invalid token format',
        message: 'Token must be provided as "Bearer <token>"'
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token || token === '') {
      return res.status(401).json({
        error: 'Token not provided',
        message: 'Please provide a valid Bearer token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    console.log(`✅ Token verified for user: ${decoded.userId} (${decoded.email})`);
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', {
      message: error.message,
      name: error.name,
      token: req.headers.authorization ? 'Present' : 'Missing'
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please login again to get a new token'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please provide a valid token'
      });
    }

    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

module.exports = authMiddleware;