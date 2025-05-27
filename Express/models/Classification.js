const database = require('../config/database');

class Classification {
    constructor(data = {}) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.image_hash = data.image_hash;
        this.image_size = data.image_size;
        this.image_type = data.image_type;
        this.prompt = data.prompt;
        this.result = data.result;
        this.confidence = data.confidence;
        this.model_used = data.model_used;
        this.processing_time_ms = data.processing_time_ms;
        this.status = data.status || 'completed';
        this.error_message = data.error_message;
        this.created_at = data.created_at;
        this.user_name = data.user_name; // For joined queries
    }

    // Create new classification record
    static async create({
        userId,
        imageHash,
        imageSize,
        imageType,
        prompt,
        result,
        confidence,
        modelUsed,
        processingTimeMs,
        status = 'completed',
        errorMessage = null
    }) {
        try {
            const query = `
        INSERT INTO classifications (
          user_id, image_hash, image_size, image_type, prompt, 
          result, confidence, model_used, processing_time_ms, 
          status, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

            const values = [
                userId, imageHash, imageSize, imageType, prompt,
                result, confidence, modelUsed, processingTimeMs,
                status, errorMessage
            ];

            const queryResult = await database.query(query, values);
            return new Classification(queryResult.rows[0]);
        } catch (error) {
            throw error;
        }
    }

    // Find classification by ID
    static async findById(id) {
        try {
            const query = `
        SELECT c.*, u.name as user_name
        FROM classifications c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = $1
      `;

            const result = await database.query(query, [id]);
            return result.rows[0] ? new Classification(result.rows[0]) : null;
        } catch (error) {
            throw error;
        }
    }

    // Get user's classification history
    static async findByUserId(userId, { limit = 20, offset = 0, status = null } = {}) {
        try {
            let query = `
        SELECT c.*, u.name as user_name
        FROM classifications c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.user_id = $1
      `;

            const params = [userId];

            if (status) {
                query += ` AND c.status = $${params.length + 1}`;
                params.push(status);
            }

            query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);

            const result = await database.query(query, params);
            return result.rows.map(row => new Classification(row));
        } catch (error) {
            throw error;
        }
    }

    // Get recent classifications (for admin/analytics)
    static async getRecent({ limit = 50, offset = 0, status = null } = {}) {
        try {
            let query = `
        SELECT c.*, u.name as user_name
        FROM classifications c
        LEFT JOIN users u ON c.user_id = u.id
      `;

            const params = [];

            if (status) {
                query += ` WHERE c.status = $1`;
                params.push(status);
            }

            query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);

            const result = await database.query(query, params);
            return result.rows.map(row => new Classification(row));
        } catch (error) {
            throw error;
        }
    }

    // Get classification statistics
    static async getStats(userId = null) {
        try {
            let query = `
        SELECT 
          COUNT(*) as total_classifications,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_classifications,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_classifications,
          AVG(processing_time_ms) as avg_processing_time,
          MAX(processing_time_ms) as max_processing_time,
          MIN(processing_time_ms) as min_processing_time,
          COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as last_24h,
          COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7_days,
          COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as last_30_days
        FROM classifications
      `;

            const params = [];

            if (userId) {
                query += ` WHERE user_id = $1`;
                params.push(userId);
            }

            const result = await database.query(query, params);
            const stats = result.rows[0];

            // Convert to numbers and format
            return {
                total_classifications: parseInt(stats.total_classifications),
                successful_classifications: parseInt(stats.successful_classifications),
                failed_classifications: parseInt(stats.failed_classifications),
                success_rate: stats.total_classifications > 0
                    ? ((stats.successful_classifications / stats.total_classifications) * 100).toFixed(2)
                    : 0,
                avg_processing_time: Math.round(parseFloat(stats.avg_processing_time) || 0),
                max_processing_time: parseInt(stats.max_processing_time) || 0,
                min_processing_time: parseInt(stats.min_processing_time) || 0,
                last_24h: parseInt(stats.last_24h),
                last_7_days: parseInt(stats.last_7_days),
                last_30_days: parseInt(stats.last_30_days)
            };
        } catch (error) {
            throw error;
        }
    }

    // Get most used models
    static async getModelStats() {
        try {
            const query = `
        SELECT 
          model_used,
          COUNT(*) as usage_count,
          AVG(processing_time_ms) as avg_processing_time,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count
        FROM classifications
        WHERE model_used IS NOT NULL
        GROUP BY model_used
        ORDER BY usage_count DESC
      `;

            const result = await database.query(query);
            return result.rows.map(row => ({
                model: row.model_used,
                usage_count: parseInt(row.usage_count),
                avg_processing_time: Math.round(parseFloat(row.avg_processing_time)),
                successful_count: parseInt(row.successful_count),
                success_rate: ((row.successful_count / row.usage_count) * 100).toFixed(2)
            }));
        } catch (error) {
            throw error;
        }
    }

    // Search classifications by result content
    static async search(searchTerm, { userId = null, limit = 20, offset = 0 } = {}) {
        try {
            let query = `
        SELECT c.*, u.name as user_name
        FROM classifications c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE (c.result ILIKE $1 OR c.prompt ILIKE $1)
      `;

            const params = [`%${searchTerm}%`];

            if (userId) {
                query += ` AND c.user_id = $${params.length + 1}`;
                params.push(userId);
            }

            query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);

            const result = await database.query(query, params);
            return result.rows.map(row => new Classification(row));
        } catch (error) {
            throw error;
        }
    }

    // Update classification status
    async updateStatus(status, errorMessage = null) {
        try {
            const query = `
        UPDATE classifications 
        SET status = $1, error_message = $2
        WHERE id = $3
        RETURNING *
      `;

            const result = await database.query(query, [status, errorMessage, this.id]);
            const updated = result.rows[0];

            this.status = updated.status;
            this.error_message = updated.error_message;

            return this;
        } catch (error) {
            throw error;
        }
    }

    // Delete classification (soft delete by setting status)
    async delete() {
        try {
            const query = `
        UPDATE classifications 
        SET status = 'deleted'
        WHERE id = $1
      `;

            await database.query(query, [this.id]);
            this.status = 'deleted';

            return this;
        } catch (error) {
            throw error;
        }
    }

    // Convert to safe object
    toSafeObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            user_name: this.user_name,
            image_hash: this.image_hash,
            image_size: this.image_size,
            image_type: this.image_type,
            prompt: this.prompt,
            result: this.result,
            confidence: this.confidence,
            model_used: this.model_used,
            processing_time_ms: this.processing_time_ms,
            status: this.status,
            error_message: this.error_message,
            created_at: this.created_at
        };
    }

    // Convert to public object (minimal info)
    toPublicObject() {
        return {
            id: this.id,
            result: this.result,
            confidence: this.confidence,
            model_used: this.model_used,
            processing_time_ms: this.processing_time_ms,
            created_at: this.created_at
        };
    }

    // Add missing query method for compatibility
    static async query(sql, params) {
        return await database.query(sql, params);
    }
}

module.exports = Classification;