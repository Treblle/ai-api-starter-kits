const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const { userQueries } = require('../db/db');
const { generateToken } = require('../middleware/authMiddleware');
const { asyncHandler, BadRequestError, UnauthorizedError } = require('../middleware/errorHandler');

/**
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError('Validation failed', errors.array());
    }

    const { email, password } = req.body;

    try {
        // Check if user already exists
        const existingUser = await userQueries.findByEmail(email);
        if (existingUser.rows.length > 0) {
            throw new BadRequestError('User already exists with this email address');
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await userQueries.create(email, passwordHash);
        const newUser = result.rows[0];

        // Generate JWT token
        const token = generateToken(newUser.id, newUser.email);

        console.log(`✅ User registered successfully: ${email}`);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                createdAt: newUser.created_at,
            },
            token,
            tokenType: 'Bearer',
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        });

    } catch (error) {
        if (error.code === '23505') { // PostgreSQL unique violation
            throw new BadRequestError('User already exists with this email address');
        }
        throw error;
    }
});

/**
 * Login user
 */
const login = asyncHandler(async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError('Validation failed', errors.array());
    }

    const { email, password } = req.body;

    try {
        // Find user by email
        const result = await userQueries.findByEmail(email);
        if (result.rows.length === 0) {
            throw new UnauthorizedError('Invalid email or password');
        }

        const user = result.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedError('Invalid email or password');
        }

        // Generate JWT token
        const token = generateToken(user.id, user.email);

        console.log(`✅ User logged in successfully: ${email}`);

        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                createdAt: user.created_at,
            },
            token,
            tokenType: 'Bearer',
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        });

    } catch (error) {
        // Log failed login attempts for security monitoring
        console.warn(`⚠️ Failed login attempt for email: ${email} from IP: ${req.ip}`);
        throw error;
    }
});

/**
 * Get current user profile
 */
const profile = asyncHandler(async (req, res) => {
    // User is already attached to req by authenticateToken middleware
    const user = req.user;

    try {
        // Fetch fresh user data from database
        const result = await userQueries.findById(user.id);
        if (result.rows.length === 0) {
            throw new UnauthorizedError('User not found');
        }

        const userData = result.rows[0];

        res.status(200).json({
            user: {
                id: userData.id,
                email: userData.email,
                createdAt: userData.created_at,
            },
            message: 'Profile retrieved successfully',
        });

    } catch (error) {
        throw error;
    }
});

/**
 * Refresh JWT token
 */
const refreshToken = asyncHandler(async (req, res) => {
    // User is already authenticated via middleware
    const user = req.user;

    try {
        // Generate new token
        const newToken = generateToken(user.id, user.email);

        console.log(`🔄 Token refreshed for user: ${user.email}`);

        res.status(200).json({
            message: 'Token refreshed successfully',
            token: newToken,
            tokenType: 'Bearer',
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        });

    } catch (error) {
        throw error;
    }
});

/**
 * Logout user (client-side token invalidation)
 */
const logout = asyncHandler(async (req, res) => {
    // Since we're using stateless JWT, we can't actually invalidate the token server-side
    // This endpoint is mainly for consistency and client-side cleanup
    const user = req.user;

    console.log(`👋 User logged out: ${user.email}`);

    res.status(200).json({
        message: 'Logout successful. Please remove the token from your client.',
        hint: 'For enhanced security, consider implementing a token blacklist or shorter token expiration times.',
    });
});

module.exports = {
    register,
    login,
    profile,
    refreshToken,
    logout,
};