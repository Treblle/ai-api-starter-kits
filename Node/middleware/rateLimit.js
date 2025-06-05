const rateLimit = require('express-rate-limit');

// General rate limiter for all requests
const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again after 15 minutes.',
        retryAfter: '15 minutes',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication endpoints
const strictRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    message: {
        error: 'Too Many Authentication Attempts',
        message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
        retryAfter: '15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
});

// API-specific rate limiter for summarization endpoint
const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 API calls per minute
    message: {
        error: 'API Rate Limit Exceeded',
        message: 'Too many API requests. Please wait before making more summarization requests.',
        retryAfter: '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user ? `user:${req.user.id}` : req.ip;
    },
});

module.exports = {
    rateLimiter,
    strictRateLimiter,
    apiRateLimiter,
};