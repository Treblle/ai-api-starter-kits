const slowDown = require('express-slow-down');

// DDoS protection via request slowing
const ddosProtection = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // allow 50 requests per 15 minutes at full speed
    delayMs: () => 500, // Fixed delay function for v2+ compatibility
    maxDelayMs: 20000, // maximum delay of 20 seconds
    skipFailedRequests: false, // Don't count failed requests
    skipSuccessfulRequests: false, // Count all requests

    // Custom key generator to identify users
    keyGenerator: (req) => {
        return req.ip;
    },

    // Skip certain routes that should be fast
    skip: (req) => {
        const skipPaths = ['/health', '/favicon.ico'];
        return skipPaths.includes(req.path);
    },

    // Remove deprecated onLimitReached - use handler instead
    handler: (req, res) => {
        console.warn(`⚠️ DDoS protection activated for IP: ${req.ip}`);
        // Don't send response here, let the middleware handle it
    },

    // Disable validation warnings
    validate: {
        delayMs: false,
    },
});

module.exports = ddosProtection;