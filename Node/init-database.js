const { initializeDatabase } = require('./db/db');

async function initDatabase() {
    try {
        console.log('🚀 Initializing database...');
        await initializeDatabase();
        console.log('✅ Database initialization completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

initDatabase();