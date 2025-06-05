const { validationResult } = require('express-validator');
const apyhubService = require('../services/apyhubService');
const { summaryQueries } = require('../db/db');
const { asyncHandler, BadRequestError } = require('../middleware/errorHandler');

/**
 * Summarize text using AI
 */
const summarizeText = asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError('Validation failed', errors.array());
    }

    const { text, summaryLength = 'short', outputLanguage = 'en' } = req.body;
    const user = req.user;

    try {
        const startTime = Date.now();

        // Call ApyHub API to summarize text
        const summaryResult = await apyhubService.summarizeText(text, summaryLength, outputLanguage);

        const processingTime = Date.now() - startTime;

        // Save summary to database
        const saveResult = await summaryQueries.create(
            user.id,
            text,
            summaryResult.summary,
            summaryLength
        );

        console.log(`✅ Text summarized successfully for user: ${user.email} (${processingTime}ms)`);

        res.status(200).json({
            message: 'Text summarized successfully',
            data: {
                id: saveResult.rows[0].id,
                originalText: text,
                summary: summaryResult.summary,
                summaryLength: summaryLength,
                outputLanguage: outputLanguage,
                statistics: {
                    originalLength: summaryResult.originalLength,
                    summaryCharCount: summaryResult.summaryLength,
                    compressionRatio: (summaryResult.summaryLength / summaryResult.originalLength * 100).toFixed(1) + '%',
                    processingTimeMs: processingTime,
                },
                createdAt: saveResult.rows[0].created_at,
            },
        });

    } catch (error) {
        console.error(`❌ Text summarization failed for user ${user.email}:`, error.message);

        // Handle specific ApyHub API errors
        if (error.message.includes('rate limit')) {
            return res.status(429).json({
                error: 'Service Rate Limit',
                message: 'ApyHub API rate limit exceeded. Please try again later.',
                retryAfter: 60,
            });
        }

        if (error.message.includes('API key')) {
            return res.status(503).json({
                error: 'Service Configuration Error',
                message: 'Summarization service is temporarily unavailable. Please try again later.',
            });
        }

        throw error;
    }
});

/**
 * Summarize URL using AI
 */
const summarizeUrl = asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError('Validation failed', errors.array());
    }

    const { url, summaryLength = 'short', outputLanguage = 'en' } = req.body;
    const user = req.user;

    try {
        const startTime = Date.now();

        // Call ApyHub API to summarize URL
        const summaryResult = await apyhubService.summarizeUrl(url, summaryLength, outputLanguage);

        const processingTime = Date.now() - startTime;

        // Save summary to database (using URL as original text)
        const saveResult = await summaryQueries.create(
            user.id,
            `URL: ${url}`,
            summaryResult.summary,
            summaryLength
        );

        console.log(`✅ URL summarized successfully for user: ${user.email} (${processingTime}ms)`);

        res.status(200).json({
            message: 'URL summarized successfully',
            data: {
                id: saveResult.rows[0].id,
                sourceUrl: url,
                summary: summaryResult.summary,
                summaryLength: summaryLength,
                outputLanguage: outputLanguage,
                statistics: {
                    summaryCharCount: summaryResult.summaryLength,
                    processingTimeMs: processingTime,
                },
                createdAt: saveResult.rows[0].created_at,
            },
        });

    } catch (error) {
        console.error(`❌ URL summarization failed for user ${user.email}:`, error.message);

        // Handle specific errors
        if (error.message.includes('Invalid URL')) {
            throw new BadRequestError('Invalid URL format provided');
        }

        if (error.message.includes('rate limit')) {
            return res.status(429).json({
                error: 'Service Rate Limit',
                message: 'ApyHub API rate limit exceeded. Please try again later.',
                retryAfter: 60,
            });
        }

        throw error;
    }
});

/**
 * Get user's summarization history
 */
const getHistory = asyncHandler(async (req, res) => {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 items per page
    const offset = (page - 1) * limit;

    try {
        const result = await summaryQueries.findByUserId(user.id, limit, offset);
        const summaries = result.rows;

        // Format the response
        const formattedSummaries = summaries.map(summary => ({
            id: summary.id,
            originalText: summary.original_text.length > 100
                ? summary.original_text.substring(0, 100) + '...'
                : summary.original_text,
            summary: summary.summary_text,
            summaryLength: summary.summary_length,
            createdAt: summary.created_at,
            isUrl: summary.original_text.startsWith('URL: '),
        }));

        res.status(200).json({
            message: 'Summarization history retrieved successfully',
            data: {
                summaries: formattedSummaries,
                pagination: {
                    page,
                    limit,
                    total: summaries.length,
                    hasMore: summaries.length === limit,
                },
            },
        });

    } catch (error) {
        console.error(`❌ Failed to fetch history for user ${user.email}:`, error.message);
        throw error;
    }
});

/**
 * Get supported languages and options
 */
const getOptions = asyncHandler(async (req, res) => {
    const supportedLanguages = apyhubService.getSupportedLanguages();

    res.status(200).json({
        message: 'Summarization options retrieved successfully',
        data: {
            summaryLengths: [
                { value: 'short', description: 'Short summary (max 20 words)' },
                { value: 'medium', description: 'Medium summary (max 60 words)' },
                { value: 'long', description: 'Long summary (max 100 words)' },
            ],
            supportedLanguages,
            limits: {
                maxTextLength: '~12,000 words',
                maxTokens: 16385,
                rateLimit: '10 requests per minute',
            },
        },
    });
});

/**
 * Health check for summarization service
 */
const healthCheck = asyncHandler(async (req, res) => {
    try {
        const healthStatus = await apyhubService.getApiHealth();

        res.status(healthStatus.status === 'healthy' ? 200 : 503).json({
            message: 'Summarization service health check',
            ...healthStatus,
        });

    } catch (error) {
        res.status(503).json({
            message: 'Summarization service health check failed',
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

module.exports = {
    summarizeText,
    summarizeUrl,
    getHistory,
    getOptions,
    healthCheck,
};