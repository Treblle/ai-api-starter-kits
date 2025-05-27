const rateLimit = require('express-rate-limit');

// General rate limiter
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    });
  }
});

// Stricter rate limiter for auth endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please wait before attempting to authenticate again.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please wait before attempting to authenticate again.',
      retryAfter: 900
    });
  }
});

// Rate limiter for classification endpoint (more resource intensive)
const classifyRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 classification requests per 5 minutes
  message: {
    error: 'Classification rate limit exceeded',
    message: 'Image classification is resource intensive. Please wait before making another request.',
    retryAfter: 300 // 5 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Classification rate limit exceeded',
      message: 'Image classification is resource intensive. Please wait before making another request.',
      retryAfter: 300
    });
  }
});

module.exports = {
  rateLimiter,
  authRateLimiter,
  classifyRateLimiter
};