-- Performance optimization migration for date range queries

-- Add composite index for user_id and created_at (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_classifications_user_created 
ON classifications(user_id, created_at DESC);

-- Add partial indexes for date range queries with status filtering
CREATE INDEX IF NOT EXISTS idx_classifications_date_status_completed 
ON classifications(created_at DESC) 
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_classifications_date_status_error 
ON classifications(created_at DESC) 
WHERE status = 'error';

-- Add index for model usage statistics
CREATE INDEX IF NOT EXISTS idx_classifications_model_created 
ON classifications(model_used, created_at DESC);

-- Add index for image hash lookups (deduplication queries)
CREATE INDEX IF NOT EXISTS idx_classifications_hash_created 
ON classifications(image_hash, created_at DESC);

-- Add index for processing time analytics
CREATE INDEX IF NOT EXISTS idx_classifications_processing_time 
ON classifications(processing_time_ms) 
WHERE processing_time_ms IS NOT NULL;

-- Update statistics for better query planning
ANALYZE classifications;

-- Comments for documentation
COMMENT ON INDEX idx_classifications_user_created IS 'Optimizes user classification history queries';
COMMENT ON INDEX idx_classifications_date_status_completed IS 'Optimizes date range queries for completed classifications';
COMMENT ON INDEX idx_classifications_date_status_error IS 'Optimizes date range queries for failed classifications';
COMMENT ON INDEX idx_classifications_model_created IS 'Optimizes model usage statistics queries';
COMMENT ON INDEX idx_classifications_hash_created IS 'Optimizes duplicate image detection queries';
COMMENT ON INDEX idx_classifications_processing_time IS 'Optimizes performance analytics queries';