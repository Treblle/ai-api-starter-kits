const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
  
    // Log error for debugging
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  
    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
      const message = 'Invalid resource ID format';
      error = { message, statusCode: 400 };
    }
  
    // Mongoose duplicate key
    if (err.code === 11000) {
      const message = 'Duplicate field value entered';
      error = { message, statusCode: 400 };
    }
  
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message).join(', ');
      error = { message, statusCode: 400 };
    }
  
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      const message = 'Invalid token';
      error = { message, statusCode: 401 };
    }
  
    if (err.name === 'TokenExpiredError') {
      const message = 'Token expired';
      error = { message, statusCode: 401 };
    }
  
    // File upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      const message = 'File size too large';
      error = { message, statusCode: 413 };
    }
  
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const message = 'Unexpected file field';
      error = { message, statusCode: 400 };
    }
  
    // Default error response
    const statusCode = error.statusCode || err.statusCode || 500;
    const message = error.message || 'Internal server error';
  
    // Don't leak error details in production
    const errorResponse = {
      error: message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: error
      })
    };
  
    res.status(statusCode).json(errorResponse);
  };
  
  module.exports = { errorHandler };