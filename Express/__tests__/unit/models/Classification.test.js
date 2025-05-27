const Classification = require('../../../models/Classification');
const database = require('../../../config/database');

// Mock database
jest.mock('../../../config/database', () => ({
    query: jest.fn()
}));

describe('Classification Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new classification record', async () => {
            const classificationData = {
                userId: 1,
                imageHash: 'abc123',
                imageSize: 1024,
                imageType: 'image/jpeg',
                prompt: 'What is this?',
                result: 'A dog',
                confidence: 'High',
                modelUsed: 'moondream',
                processingTimeMs: 1500,
                status: 'completed'
            };

            const mockResult = {
                rows: [{
                    id: 1,
                    user_id: 1,
                    image_hash: 'abc123',
                    image_size: 1024,
                    image_type: 'image/jpeg',
                    prompt: 'What is this?',
                    result: 'A dog',
                    confidence: 'High',
                    model_used: 'moondream',
                    processing_time_ms: 1500,
                    status: 'completed',
                    created_at: new Date()
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const classification = await Classification.create(classificationData);

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO classifications'),
                expect.arrayContaining([
                    1, 'abc123', 1024, 'image/jpeg', 'What is this?',
                    'A dog', 'High', 'moondream', 1500, 'completed', null
                ])
            );

            expect(classification).toBeInstanceOf(Classification);
            expect(classification.id).toBe(1);
            expect(classification.result).toBe('A dog');
        });
    });

    describe('findById', () => {
        it('should find classification by ID', async () => {
            const mockResult = {
                rows: [{
                    id: 1,
                    user_id: 1,
                    image_hash: 'abc123',
                    result: 'A dog',
                    status: 'completed',
                    created_at: new Date(),
                    user_name: 'Test User'
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const classification = await Classification.findById(1);

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT c.*, u.name as user_name'),
                [1]
            );

            expect(classification).toBeInstanceOf(Classification);
            expect(classification.id).toBe(1);
            expect(classification.user_name).toBe('Test User');
        });

        it('should return null if classification not found', async () => {
            database.query.mockResolvedValueOnce({ rows: [] });

            const classification = await Classification.findById(999);

            expect(classification).toBeNull();
        });
    });

    describe('findByUserId', () => {
        it('should find classifications by user ID with pagination', async () => {
            const mockResult = {
                rows: [
                    {
                        id: 1,
                        user_id: 1,
                        result: 'A dog',
                        status: 'completed',
                        created_at: new Date()
                    },
                    {
                        id: 2,
                        user_id: 1,
                        result: 'A cat',
                        status: 'completed',
                        created_at: new Date()
                    }
                ]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const classifications = await Classification.findByUserId(1, {
                limit: 10,
                offset: 0
            });

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE c.user_id = $1'),
                [1, 10, 0]
            );

            expect(classifications).toHaveLength(2);
            expect(classifications[0]).toBeInstanceOf(Classification);
        });

        it('should filter by status when provided', async () => {
            const mockResult = { rows: [] };
            database.query.mockResolvedValueOnce(mockResult);

            await Classification.findByUserId(1, {
                limit: 10,
                offset: 0,
                status: 'completed'
            });

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('AND c.status = $2'),
                [1, 'completed', 10, 0]
            );
        });
    });

    describe('getStats', () => {
        it('should return classification statistics', async () => {
            const mockResult = {
                rows: [{
                    total_classifications: '100',
                    successful_classifications: '95',
                    failed_classifications: '5',
                    avg_processing_time: '1200.5',
                    max_processing_time: '3000',
                    min_processing_time: '500',
                    last_24h: '10',
                    last_7_days: '50',
                    last_30_days: '80'
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const stats = await Classification.getStats();

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                []
            );

            expect(stats.total_classifications).toBe(100);
            expect(stats.successful_classifications).toBe(95);
            expect(stats.success_rate).toBe('95.00');
            expect(stats.avg_processing_time).toBe(1201); // Rounded
        });

        it('should return statistics for specific user', async () => {
            const mockResult = {
                rows: [{
                    total_classifications: '20',
                    successful_classifications: '18',
                    failed_classifications: '2',
                    avg_processing_time: '1100',
                    max_processing_time: '2000',
                    min_processing_time: '800',
                    last_24h: '3',
                    last_7_days: '12',
                    last_30_days: '18'
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const stats = await Classification.getStats(1);

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE user_id = $1'),
                [1]
            );

            expect(stats.total_classifications).toBe(20);
            expect(stats.success_rate).toBe('90.00');
        });
    });

    describe('search', () => {
        it('should search classifications by text', async () => {
            const mockResult = {
                rows: [{
                    id: 1,
                    result: 'A beautiful dog running in the park',
                    prompt: 'What do you see?',
                    created_at: new Date()
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            const results = await Classification.search('dog', {
                userId: 1,
                limit: 10,
                offset: 0
            });

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE (c.result ILIKE $1 OR c.prompt ILIKE $1)'),
                ['%dog%', 1, 10, 0]
            );

            expect(results).toHaveLength(1);
            expect(results[0]).toBeInstanceOf(Classification);
        });
    });

    describe('updateStatus', () => {
        it('should update classification status', async () => {
            const classification = new Classification({ id: 1 });

            const mockResult = {
                rows: [{
                    status: 'error',
                    error_message: 'Processing failed'
                }]
            };

            database.query.mockResolvedValueOnce(mockResult);

            await classification.updateStatus('error', 'Processing failed');

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE classifications'),
                ['error', 'Processing failed', 1]
            );

            expect(classification.status).toBe('error');
            expect(classification.error_message).toBe('Processing failed');
        });
    });

    describe('delete', () => {
        it('should soft delete classification', async () => {
            const classification = new Classification({ id: 1 });

            await classification.delete();

            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE classifications'),
                [1]
            );

            expect(classification.status).toBe('deleted');
        });
    });

    describe('toSafeObject', () => {
        it('should return safe classification object', () => {
            const classification = new Classification({
                id: 1,
                user_id: 1,
                user_name: 'Test User',
                image_hash: 'abc123',
                result: 'A dog',
                status: 'completed',
                created_at: new Date()
            });

            const safeObject = classification.toSafeObject();

            expect(safeObject.id).toBe(1);
            expect(safeObject.user_name).toBe('Test User');
            expect(safeObject.result).toBe('A dog');
            expect(safeObject).toHaveProperty('created_at');
        });
    });
});