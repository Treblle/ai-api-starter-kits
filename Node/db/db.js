const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test database connection
pool.on('connect', () => {
    console.log('📅 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
    process.exit(-1);
});

// Initialize database tables
const initializeDatabase = async () => {
    try {
        const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

        const createSummariesTable = `
      CREATE TABLE IF NOT EXISTS summaries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        original_text TEXT NOT NULL,
        summary_text TEXT NOT NULL,
        summary_length VARCHAR(20) DEFAULT 'short',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

        await pool.query(createUsersTable);
        await pool.query(createSummariesTable);
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
};

// Database query wrapper with error handling
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('📊 Query executed', { text: text.substring(0, 50), duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('❌ Database query error:', error);
        throw error;
    }
};

// User-related database operations
const userQueries = {
    create: async (email, passwordHash) => {
        const text = 'INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING id, email, created_at';
        const values = [email, passwordHash];
        return query(text, values);
    },

    findByEmail: async (email) => {
        const text = 'SELECT id, email, password_hash, created_at FROM users WHERE email = $1';
        const values = [email];
        return query(text, values);
    },

    findById: async (id) => {
        const text = 'SELECT id, email, created_at FROM users WHERE id = $1';
        const values = [id];
        return query(text, values);
    },
};

// Summary-related database operations
const summaryQueries = {
    create: async (userId, originalText, summaryText, summaryLength) => {
        const text = `
      INSERT INTO summaries(user_id, original_text, summary_text, summary_length) 
      VALUES($1, $2, $3, $4) 
      RETURNING id, created_at
    `;
        const values = [userId, originalText, summaryText, summaryLength];
        return query(text, values);
    },

    findByUserId: async (userId, limit = 10, offset = 0) => {
        const text = `
      SELECT id, original_text, summary_text, summary_length, created_at 
      FROM summaries 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
        const values = [userId, limit, offset];
        return query(text, values);
    },
};

module.exports = {
    pool,
    query,
    initializeDatabase,
    userQueries,
    summaryQueries,
};