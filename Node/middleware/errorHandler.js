// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error('❌ Error caught by global handler:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
    });

    // Default error
    let error = {
        status: 500,
        message: 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };

    // Handle specific error types
    if (err.name === 'ValidationError') {
        error = {
            status: 400,
            message: 'Validation Error',
            details: err.details || err.message,
        };
    } else if (err.name === 'UnauthorizedError') {
        error = {
            status: 401,
            message: 'Unauthorized',
            details: 'Invalid or missing authentication token',
        };
    } else if (err.code === '23505') { // PostgreSQL unique violation
        error = {
            status: 409,
            message: 'Conflict',
            details: 'Resource already exists',
        };
    } else if (err.code === '23503') { // PostgreSQL foreign key violation
        error = {
            status: 400,
            message: 'Bad Request',
            details: 'Referenced resource does not exist',
        };
    } else if (err.code === 'ECONNREFUSED') {
        error = {
            status: 503,
            message: 'Service Unavailable',
            details: 'Unable to connect to external service',
        };
    } else if (err.status && err.status < 500) {
        // Client errors - pass through
        error = {
            status: err.status,
            message: err.message || 'Bad Request',
            ...(err.details && { details: err.details }),
        };
    }

    // Send error response
    res.status(error.status).json({
        error: error.message,
        ...(error.details && { details: error.details }),
        ...(error.stack && { stack: error.stack }),
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
    });
};

// Async error wrapper utility
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error classes
class ValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}

class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
        this.status = 404;
    }
}

class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized access') {
        super(message);
        this.name = 'UnauthorizedError';
        this.status = 401;
    }
}

class BadRequestError extends Error {
    constructor(message = 'Bad request', details) {
        super(message);
        this.name = 'BadRequestError';
        this.status = 400;
        this.details = details;
    }
}

module.exports = {
    errorHandler,
    asyncHandler,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    BadRequestError,
};