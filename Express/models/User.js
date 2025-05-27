const database = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * User model for authentication and profile management
 * @class User
 */
class User {
    /**
     * Create a User instance
     * @param {Object} data - User data object
     * @param {number} data.id - User ID
     * @param {string} data.email - User email address
     * @param {string} data.name - User display name
     * @param {string} data.password - Hashed password
     * @param {Date} data.created_at - Account creation timestamp
     * @param {Date} data.updated_at - Last update timestamp
     * @param {Date} data.last_login - Last login timestamp
     * @param {boolean} data.is_active - Account active status
     * @param {string} data.api_key - Generated API key for authentication
     */
    constructor(data = {}) {
        this.id = data.id;
        this.email = data.email;
        this.name = data.name;
        this.password = data.password;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.last_login = data.last_login;
        this.is_active = data.is_active !== undefined ? data.is_active : true;
        this.api_key = data.api_key;
    }

    /**
     * Creates a new user with hashed password and generated API key
     * @param {Object} userData - User registration data
     * @param {string} userData.email - User email address
     * @param {string} userData.name - User display name
     * @param {string} userData.password - Plain text password (will be hashed)
     * @returns {Promise<User>} Newly created user instance
     * @throws {Error} If email already exists or validation fails
     */
    static async create({ email, name, password }) {
        try {
            // Hash password using bcrypt with salt rounds of 12
            const hashedPassword = await bcrypt.hash(password, 12);

            // Generate secure random API key
            const apiKey = require('crypto').randomBytes(32).toString('hex');

            const query = `
        INSERT INTO users (email, name, password, api_key)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, created_at, is_active, api_key
      `;

            const result = await database.query(query, [email, name, hashedPassword, apiKey]);
            return new User(result.rows[0]);
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'users_email_key') {
                throw new Error('User with this email already exists');
            }
            throw error;
        }
    }

    /**
     * Finds an active user by email address
     * @param {string} email - User email address
     * @returns {Promise<User|null>} User instance or null if not found
     */
    static async findByEmail(email) {
        try {
            const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
            const result = await database.query(query, [email]);

            return result.rows[0] ? new User(result.rows[0]) : null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Finds an active user by ID
     * @param {number} id - User ID
     * @returns {Promise<User|null>} User instance or null if not found
     */
    static async findById(id) {
        try {
            const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
            const result = await database.query(query, [id]);

            return result.rows[0] ? new User(result.rows[0]) : null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Finds an active user by API key
     * @param {string} apiKey - User API key
     * @returns {Promise<User|null>} User instance or null if not found
     */
    static async findByApiKey(apiKey) {
        try {
            const query = 'SELECT * FROM users WHERE api_key = $1 AND is_active = true';
            const result = await database.query(query, [apiKey]);

            return result.rows[0] ? new User(result.rows[0]) : null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Verifies a plain text password against the stored hash
     * @param {string} password - Plain text password to verify
     * @returns {Promise<boolean>} True if password matches, false otherwise
     */
    async verifyPassword(password) {
        try {
            return await bcrypt.compare(password, this.password);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Updates the user's last login timestamp
     * @returns {Promise<Date>} Updated last login timestamp
     */
    async updateLastLogin() {
        try {
            const query = `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING last_login
      `;

            const result = await database.query(query, [this.id]);
            this.last_login = result.rows[0].last_login;
            return this.last_login;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Updates user profile information
     * @param {Object} updateData - Data to update
     * @param {string} [updateData.name] - New display name
     * @param {string} [updateData.email] - New email address
     * @returns {Promise<User>} Updated user instance
     * @throws {Error} If email is already in use by another user
     */
    async update({ name, email }) {
        try {
            const query = `
        UPDATE users 
        SET name = COALESCE($1, name),
            email = COALESCE($2, email),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, email, name, updated_at
      `;

            const result = await database.query(query, [name, email, this.id]);
            const updated = result.rows[0];

            // Update current instance
            this.name = updated.name;
            this.email = updated.email;
            this.updated_at = updated.updated_at;

            return this;
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'users_email_key') {
                throw new Error('Email already in use');
            }
            throw error;
        }
    }

    /**
     * Changes the user's password
     * @param {string} newPassword - New plain text password
     * @returns {Promise<User>} Updated user instance
     */
    async changePassword(newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, 12);

            const query = `
        UPDATE users 
        SET password = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;

            await database.query(query, [hashedPassword, this.id]);
            this.password = hashedPassword;

            return this;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Generates a new API key for the user
     * @returns {Promise<string>} New API key
     */
    async regenerateApiKey() {
        try {
            const newApiKey = require('crypto').randomBytes(32).toString('hex');

            const query = `
        UPDATE users 
        SET api_key = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING api_key
      `;

            const result = await database.query(query, [newApiKey, this.id]);
            this.api_key = result.rows[0].api_key;

            return this.api_key;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Deactivates the user account (soft delete)
     * @returns {Promise<User>} Updated user instance
     */
    async deactivate() {
        try {
            const query = `
        UPDATE users 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

            await database.query(query, [this.id]);
            this.is_active = false;

            return this;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets aggregate statistics for all users
     * @returns {Promise<Object>} User statistics object
     */
    static async getStats() {
        try {
            const query = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN last_login > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_last_30_days,
          COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_last_7_days
        FROM users
      `;

            const result = await database.query(query);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets the total number of classifications for this user
     * @returns {Promise<number>} Classification count
     */
    async getClassificationCount() {
        try {
            const query = `
        SELECT COUNT(*) as classification_count
        FROM classifications 
        WHERE user_id = $1
      `;

            const result = await database.query(query, [this.id]);
            return parseInt(result.rows[0].classification_count);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Converts user instance to safe object (excludes password)
     * @returns {Object} Safe user object for API responses
     */
    toSafeObject() {
        return {
            id: this.id,
            email: this.email,
            name: this.name,
            created_at: this.created_at,
            updated_at: this.updated_at,
            last_login: this.last_login,
            is_active: this.is_active,
            api_key: this.api_key
        };
    }

    /**
     * Converts user instance to public object (minimal info for public display)
     * @returns {Object} Public user object
     */
    toPublicObject() {
        return {
            id: this.id,
            name: this.name,
            created_at: this.created_at
        };
    }
}

module.exports = User;