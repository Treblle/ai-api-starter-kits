const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    // Initialize database connection
    async connect() {
        try {
            // Database configuration
            const dbConfig = {
                user: process.env.DB_USER || 'postgres',
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || 'treblle_api',
                password: process.env.DB_PASSWORD || 'password',
                port: parseInt(process.env.DB_PORT) || 5432,
                max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum connections in pool
                idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
                connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
            };

            // Add SSL configuration for production
            if (process.env.NODE_ENV === 'production' && process.env.DB_SSL_CERT) {
                dbConfig.ssl = {
                    rejectUnauthorized: true,
                    ca: fs.readFileSync(process.env.DB_SSL_CERT)
                };
            } else if (process.env.NODE_ENV === 'production') {
                dbConfig.ssl = { rejectUnauthorized: false };
            }

            this.pool = new Pool(dbConfig);

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.isConnected = true;
            console.log('✅ Database connected successfully');
            console.log(`📊 Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);

            // Run migrations on startup
            await this.runMigrations();

        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            this.isConnected = false;
            throw error;
        }
    }

    // Run database migrations
    async runMigrations() {
        try {
            console.log('🔄 Running database migrations...');

            // Create migrations table if it doesn't exist
            await this.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

            // Get list of executed migrations
            const executedMigrations = await this.query('SELECT name FROM migrations ORDER BY id');
            const executedNames = executedMigrations.rows.map(row => row.name);

            // Read migration files
            const migrationsDir = path.join(__dirname, '../migrations');
            if (!fs.existsSync(migrationsDir)) {
                fs.mkdirSync(migrationsDir, { recursive: true });
            }

            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .sort();

            // Execute pending migrations
            for (const file of migrationFiles) {
                const migrationName = file.replace('.sql', '');

                if (!executedNames.includes(migrationName)) {
                    console.log(`📝 Executing migration: ${migrationName}`);

                    const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

                    // Execute migration in transaction
                    const client = await this.pool.connect();
                    try {
                        await client.query('BEGIN');
                        await client.query(migrationSQL);
                        await client.query('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
                        await client.query('COMMIT');
                        console.log(`✅ Migration completed: ${migrationName}`);
                    } catch (error) {
                        await client.query('ROLLBACK');
                        throw error;
                    } finally {
                        client.release();
                    }
                }
            }

            console.log('✅ All migrations completed');
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
    }

    // Execute query with connection pooling
    async query(text, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            // Log slow queries in development
            if (process.env.NODE_ENV === 'development' && duration > 1000) {
                console.warn(`🐌 Slow query (${duration}ms):`, text.substring(0, 100));
            }

            return result;
        } catch (error) {
            console.error('❌ Database query error:', error.message);
            console.error('Query:', text);
            console.error('Params:', params);
            throw error;
        }
    }

    // Execute transaction
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Get connection pool status
    getPoolStatus() {
        if (!this.pool) return null;

        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
            connected: this.isConnected
        };
    }

    // Health check
    async healthCheck() {
        try {
            const result = await this.query('SELECT 1 as health_check, NOW() as timestamp');
            return {
                status: 'healthy',
                timestamp: result.rows[0].timestamp,
                pool: this.getPoolStatus()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                pool: this.getPoolStatus()
            };
        }
    }

    // Close database connection
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('🔌 Database connection closed');
        }
    }
}

// Export singleton instance
const database = new Database();
module.exports = database;