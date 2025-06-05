const express = require('express');
const { body, query } = require('express-validator');
const {
    summarizeText,
    summarizeUrl,
    getHistory,
    getOptions,
    healthCheck
} = require('../controllers/summarizeController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { apiRateLimiter } = require('../middleware/rateLimit');
const apyhubService = require('../services/apyhubService');

const router = express.Router();

// Validation rules for text summarization
const textSummarizeValidation = [
    body('text')
        .notEmpty()
        .withMessage('Text is required')
        .isString()
        .withMessage('Text must be a string')
        .isLength({ min: 10, max: 50000 })
        .withMessage('Text must be between 10 and 50,000 characters')
        .trim(),

    body('summaryLength')
        .optional()
        .isIn(['short', 'medium', 'long'])
        .withMessage('Summary length must be short, medium, or long'),

    body('outputLanguage')
        .optional()
        .isString()
        .isLength({ min: 2, max: 5 })
        .withMessage('Output language must be a valid ISO language code')
        .custom((value) => {
            if (value && !apyhubService.isLanguageSupported(value)) {
                throw new Error('Unsupported output language');
            }
            return true;
        }),
];

// Validation rules for URL summarization
const urlSummarizeValidation = [
    body('url')
        .notEmpty()
        .withMessage('URL is required')
        .isURL({
            protocols: ['http', 'https'],
            require_protocol: true,
        })
        .withMessage('Please provide a valid HTTP or HTTPS URL')
        .isLength({ max: 2048 })
        .withMessage('URL is too long'),

    body('summaryLength')
        .optional()
        .isIn(['short', 'medium', 'long'])
        .withMessage('Summary length must be short, medium, or long'),

    body('outputLanguage')
        .optional()
        .isString()
        .isLength({ min: 2, max: 5 })
        .withMessage('Output language must be a valid ISO language code')
        .custom((value) => {
            if (value && !apyhubService.isLanguageSupported(value)) {
                throw new Error('Unsupported output language');
            }
            return true;
        }),
];

// Validation rules for history pagination
const historyValidation = [
    query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be a positive integer (max 1000)'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50'),
];

/**
 * @route   POST /api/summarize
 * @desc    Summarize text using AI
 * @access  Private
 */
router.post('/summarize',
    authenticateToken,
    apiRateLimiter,
    textSummarizeValidation,
    summarizeText
);

/**
 * @route   POST /api/summarize-url
 * @desc    Summarize URL content using AI
 * @access  Private
 */
router.post('/summarize-url',
    authenticateToken,
    apiRateLimiter,
    urlSummarizeValidation,
    summarizeUrl
);

/**
 * @route   GET /api/history
 * @desc    Get user's summarization history
 * @access  Private
 */
router.get('/history',
    authenticateToken,
    historyValidation,
    getHistory
);

/**
 * @route   GET /api/options
 * @desc    Get available summarization options
 * @access  Public
 */
router.get('/options', getOptions);

/**
 * @route   GET /api/health
 * @desc    Check summarization service health
 * @access  Public
 */
router.get('/health', healthCheck);

module.exports = router;