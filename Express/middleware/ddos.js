const slowDown = require('express-slow-down');

// DDoS protection using express-slow-down
const ddosProtection = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes at full speed
  delayMs: () => 500, // Use function format for v2.x compatibility
  maxDelayMs: 20000, // maximum delay of 20 seconds
  validate: {
    delayMs: false // Disable the warning
  },
  skip: (req, res) => {
    // Skip for health checks
    return req.path === '/health';
  }
});

module.exports = { ddosProtection };