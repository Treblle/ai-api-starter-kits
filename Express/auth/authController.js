const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Standard response format helper
const formatResponse = (success, data, message = null, meta = {}) => {
  const response = {
    success,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };

  if (message) {
    response.message = message;
  }

  return response;
};

// Register user
const register = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json(formatResponse(false, null, 'Validation failed', {
        errors: errors.array()
      }));
    }

    const { email, password, name } = req.body;

    // Generate name from email if not provided
    const userName = name && name.trim() ? name.trim() : email.split('@')[0];

    console.log('📝 Registration data:', {
      email: email,
      name: userName,
      hasPassword: !!password
    });

    // Create user
    const user = await User.create({
      email: email.toLowerCase().trim(),
      name: userName,
      password
    });

    // Generate token
    const token = generateToken(user.id, user.email);

    console.log(`✅ New user registered: ${user.email} (ID: ${user.id})`);

    const response = formatResponse(true, {
      user: user.toSafeObject(),
      token,
      auth: {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        tokenType: 'Bearer'
      }
    }, 'User registered successfully', {
      userId: user.id,
      action: 'register'
    });

    // Add token at top level for frontend compatibility
    response.token = token;

    res.status(201).json(response);

  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json(formatResponse(false, null, 'A user with this email already exists. Please try logging in instead.', {
        action: 'register',
        conflict: 'email'
      }));
    }

    console.error('Registration error:', error.message);
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Login validation errors:', errors.array());
      return res.status(400).json(formatResponse(false, null, 'Please provide valid email and password', {
        errors: errors.array()
      }));
    }

    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Find user
    const user = await User.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json(formatResponse(false, null, 'No account found with this email. Please register first.', {
        action: 'login',
        suggestion: 'register'
      }));
    }

    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json(formatResponse(false, null, 'Incorrect password. Please try again.', {
        action: 'login'
      }));
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user.id, user.email);

    console.log(`✅ User logged in: ${user.email} (ID: ${user.id})`);

    const response = formatResponse(true, {
      user: user.toSafeObject(),
      token,
      auth: {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        tokenType: 'Bearer'
      }
    }, 'Login successful', {
      userId: user.id,
      action: 'login',
      lastLogin: user.last_login
    });

    // Add token at top level for frontend compatibility
    response.token = token;

    res.status(200).json(response);

  } catch (error) {
    console.error('Login error:', error.message);
    next(error);
  }
};

// Get current user profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json(formatResponse(false, null, 'User profile could not be found', {
        userId: req.user.userId
      }));
    }

    // Get user's classification count
    const classificationCount = await user.getClassificationCount();

    const userProfile = user.toSafeObject();
    userProfile.classification_count = classificationCount;

    res.status(200).json(formatResponse(true, {
      user: userProfile
    }, null, {
      userId: user.id,
      action: 'getProfile'
    }));

  } catch (error) {
    console.error('Get profile error:', error.message);
    next(error);
  }
};

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatResponse(false, null, 'Validation failed', {
        errors: errors.array()
      }));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json(formatResponse(false, null, 'User profile could not be found', {
        userId: req.user.userId
      }));
    }

    const { name, email } = req.body;

    // Update user
    await user.update({
      name: name?.trim(),
      email: email?.toLowerCase().trim()
    });

    console.log(`✅ User profile updated: ${user.email} (ID: ${user.id})`);

    res.status(200).json(formatResponse(true, {
      user: user.toSafeObject()
    }, 'Profile updated successfully', {
      userId: user.id,
      action: 'updateProfile'
    }));

  } catch (error) {
    if (error.message.includes('already in use') || error.message.includes('already exists')) {
      return res.status(409).json(formatResponse(false, null, 'Another user is already using this email address', {
        conflict: 'email',
        action: 'updateProfile'
      }));
    }

    console.error('Update profile error:', error.message);
    next(error);
  }
};

// Change password
const changePassword = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatResponse(false, null, 'Validation failed', {
        errors: errors.array()
      }));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json(formatResponse(false, null, 'User profile could not be found', {
        userId: req.user.userId
      }));
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json(formatResponse(false, null, 'Current password is incorrect', {
        action: 'changePassword'
      }));
    }

    // Change password
    await user.changePassword(newPassword);

    console.log(`✅ Password changed for user: ${user.email} (ID: ${user.id})`);

    res.status(200).json(formatResponse(true, null, 'Password changed successfully', {
      userId: user.id,
      action: 'changePassword'
    }));

  } catch (error) {
    console.error('Change password error:', error.message);
    next(error);
  }
};

// Regenerate API key
const regenerateApiKey = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json(formatResponse(false, null, 'User profile could not be found', {
        userId: req.user.userId
      }));
    }

    const newApiKey = await user.regenerateApiKey();

    console.log(`✅ API key regenerated for user: ${user.email} (ID: ${user.id})`);

    res.status(200).json(formatResponse(true, {
      api_key: newApiKey
    }, 'API key regenerated successfully', {
      userId: user.id,
      action: 'regenerateApiKey'
    }));

  } catch (error) {
    console.error('Regenerate API key error:', error.message);
    next(error);
  }
};

// Get user statistics (for admin or user dashboard)
const getUserStats = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.userId;

    // Check if user is requesting their own stats or if they're admin
    if (userId !== req.user.userId && req.user.email !== 'admin@treblle.com') {
      return res.status(403).json(formatResponse(false, null, 'You can only access your own statistics', {
        action: 'getUserStats',
        forbidden: true
      }));
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(formatResponse(false, null, 'User not found', {
        userId: userId
      }));
    }

    // Get classification stats for this user
    const Classification = require('../models/Classification');
    const classificationStats = await Classification.getStats(userId);

    res.status(200).json(formatResponse(true, {
      user: user.toPublicObject(),
      statistics: classificationStats
    }, null, {
      userId: user.id,
      action: 'getUserStats'
    }));

  } catch (error) {
    console.error('Get user stats error:', error.message);
    next(error);
  }
};

// Get all users stats (admin only)
const getAllUsersStats = async (req, res, next) => {
  try {
    // Simple admin check - in production, implement proper role-based access
    if (req.user.email !== 'admin@treblle.com') {
      return res.status(403).json(formatResponse(false, null, 'Admin access required', {
        action: 'getAllUsersStats',
        adminOnly: true
      }));
    }

    const stats = await User.getStats();

    res.status(200).json(formatResponse(true, {
      statistics: stats
    }, null, {
      adminId: req.user.userId,
      action: 'getAllUsersStats'
    }));

  } catch (error) {
    console.error('Get all users stats error:', error.message);
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  regenerateApiKey,
  getUserStats,
  getAllUsersStats
};