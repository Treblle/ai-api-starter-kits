-- Initial database schema for Treblle Express Ollama Classifier API

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Create classifications table
CREATE TABLE classifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    image_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the image
    image_size INTEGER NOT NULL, -- Size in bytes
    image_type VARCHAR(50) NOT NULL, -- MIME type
    prompt TEXT NOT NULL,
    result TEXT,
    confidence VARCHAR(20), -- 'High', 'Medium', 'Low' or null
    model_used VARCHAR(100) NOT NULL,
    processing_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'completed', -- 'completed', 'error', 'processing', 'deleted'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create api_usage table for tracking API calls (useful for analytics and rate limiting)
CREATE TABLE api_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_classifications_user_id ON classifications(user_id);
CREATE INDEX idx_classifications_created_at ON classifications(created_at);
CREATE INDEX idx_classifications_status ON classifications(status);
CREATE INDEX idx_classifications_model_used ON classifications(model_used);
CREATE INDEX idx_classifications_image_hash ON classifications(image_hash);

CREATE INDEX idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for user statistics
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.created_at as user_created_at,
    u.last_login,
    u.is_active,
    COUNT(c.id) as total_classifications,
    COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as successful_classifications,
    COUNT(CASE WHEN c.status = 'error' THEN 1 END) as failed_classifications,
    AVG(c.processing_time_ms) as avg_processing_time,
    MAX(c.created_at) as last_classification_at
FROM users u
LEFT JOIN classifications c ON u.id = c.user_id
GROUP BY u.id, u.email, u.name, u.created_at, u.last_login, u.is_active;

-- Create view for daily analytics
CREATE VIEW daily_analytics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_classifications,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_classifications,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_classifications,
    AVG(processing_time_ms) as avg_processing_time,
    COUNT(DISTINCT user_id) as unique_users
FROM classifications
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Create function to cleanup old data (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old API usage logs
    DELETE FROM api_usage 
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Update old classifications to 'archived' status instead of deleting
    UPDATE classifications 
    SET status = 'archived'
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * (days_to_keep * 2)
    AND status NOT IN ('archived', 'deleted');
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
