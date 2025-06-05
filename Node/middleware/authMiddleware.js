const jwt = require('jsonwebtoken');
const { userQueries } = require('../db/db');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Access token required. Please provide a Bearer token in the Authorization header.',
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user details from database
        const userResult = await userQueries.findById(decoded.userId);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token - user not found',
            });
        }

        req.user = {
            id: decoded.userId,
            email: userResult.rows[0].email,
        };

        next();
    } catch (error) {
        console.error('❌ JWT verification error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token has expired. Please login again.',
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token format or signature',
            });
        }

        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Error verifying authentication token',
        });
    }
};

// Generate JWT token
const generateToken = (userId, email) => {
    return jwt.sign(
        {
            userId,
            email,
            iat: Math.floor(Date.now() / 1000),
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            issuer: 'apyhub-summarizer-api',
            audience: 'api-users',
        }
    );
};

// Verify token without throwing errors (for optional auth)
const verifyTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.userId, email: decoded.email };
    } catch (error) {
        req.user = null;
    }

    next();
};

module.exports = {
    authenticateToken,
    generateToken,
    verifyTokenOptional,
};