const express = require('express');
const { useTreblle } = require('treblle');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const summarizeRoutes = require('./routes/summarizeRoutes');

// Import middleware
const { rateLimiter, strictRateLimiter } = require('./middleware/rateLimit');
const ddosProtection = require('./middleware/ddos');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
}));

// Compression for better performance
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Treblle monitoring - should be early in middleware chain
useTreblle(app, {
    apiKey: process.env.TREBLLE_API_KEY,
    projectId: process.env.TREBLLE_PROJECT_ID,
    additionalFieldsToMask: ['password', 'token', 'apiKey'],
    showErrors: process.env.NODE_ENV !== 'production',
});

// Rate limiting and DDoS protection
app.use(rateLimiter);
app.use(ddosProtection);

// Serve static files (frontend)
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
    });
});

// API routes
app.use('/auth', strictRateLimiter, authRoutes);
app.use('/api', summarizeRoutes);

// API documentation endpoint
app.get('/docs', (req, res) => {
    res.json({
        title: 'ApyHub Summarizer API',
        version: '1.0.0',
        description: 'AI-powered text summarization API showcasing Treblle monitoring',
        endpoints: {
            auth: {
                'POST /auth/register': 'Register a new user account',
                'POST /auth/login': 'Authenticate and receive JWT token',
            },
            api: {
                'POST /api/summarize': 'Summarize text using AI (requires authentication)',
                'GET /health': 'Check API health status',
            },
        },
        authentication: 'Bearer token required for protected endpoints',
        treblle: 'Real-time API monitoring via https://treblle.com/product/aspen',
    });
});

// Catch-all for undefined routes
app.all('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        availableEndpoints: ['/health', '/docs', '/auth/register', '/auth/login', '/api/summarize'],
    });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;