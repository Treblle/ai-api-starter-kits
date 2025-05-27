/**
 * Test Data Fixtures
 * Centralized test data for consistent testing across suites
 */

const crypto = require('crypto');

class TestDataFixtures {
    /**
     * Generate test user data
     */
    static createUser(overrides = {}) {
        const timestamp = Date.now();
        return {
            email: `test.user.${timestamp}@example.com`,
            name: 'Test User',
            password: 'TestPass123',
            ...overrides
        };
    }

    /**
     * Generate multiple test users
     */
    static createUsers(count = 3) {
        return Array.from({ length: count }, (_, index) =>
            this.createUser({
                email: `test.user.${Date.now()}.${index}@example.com`,
                name: `Test User ${index + 1}`
            })
        );
    }

    /**
     * Generate test classification data
     */
    static createClassification(overrides = {}) {
        return {
            userId: 1,
            imageHash: crypto.randomBytes(32).toString('hex'),
            imageSize: 1024 * Math.floor(Math.random() * 1000) + 1024, // 1KB-1MB
            imageType: 'image/jpeg',
            prompt: 'What is in this image?',
            result: 'A test classification result',
            confidence: 'High',
            modelUsed: 'moondream',
            processingTimeMs: Math.floor(Math.random() * 3000) + 500, // 0.5-3.5s
            status: 'completed',
            ...overrides
        };
    }

    /**
     * Generate multiple test classifications
     */
    static createClassifications(count = 5, userId = 1) {
        return Array.from({ length: count }, (_, index) =>
            this.createClassification({
                userId,
                prompt: `Test prompt ${index + 1}`,
                result: `Test result ${index + 1}: ${this.getRandomClassificationResult()}`
            })
        );
    }

    /**
     * Get random classification results for variety
     */
    static getRandomClassificationResult() {
        const results = [
            'A brown dog sitting in a park',
            'A red car parked on the street',
            'A white cat sleeping on a couch',
            'A blue sky with white clouds',
            'A green tree with many leaves',
            'A yellow flower in a garden',
            'A black bird flying in the sky',
            'A wooden table with books on it'
        ];
        return results[Math.floor(Math.random() * results.length)];
    }

    /**
     * Create test image buffer (1x1 PNG)
     */
    static createImageBuffer() {
        return Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
            0x60, 0x82
        ]);
    }

    /**
     * Create test image as base64 string
     */
    static createImageBase64() {
        return this.createImageBuffer().toString('base64');
    }

    /**
     * Create data URL for image
     */
    static createImageDataUrl() {
        return `data:image/png;base64,${this.createImageBase64()}`;
    }

    /**
     * Create JWT token for testing
     */
    static createJwtToken(payload = {}, secret = 'test-secret') {
        const jwt = require('jsonwebtoken');
        const defaultPayload = {
            userId: 1,
            email: 'test@example.com',
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(
            { ...defaultPayload, ...payload },
            secret,
            { expiresIn: '1h' }
        );
    }

    /**
     * Create expired JWT token for testing
     */
    static createExpiredJwtToken(payload = {}, secret = 'test-secret') {
        const jwt = require('jsonwebtoken');
        const expiredPayload = {
            userId: 1,
            email: 'test@example.com',
            iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
            exp: Math.floor(Date.now() / 1000) - 3600  // 1 hour ago
        };

        return jwt.sign(
            { ...expiredPayload, ...payload },
            secret
        );
    }

    /**
     * Create invalid JWT token for testing
     */
    static createInvalidJwtToken() {
        return 'invalid.jwt.token.format';
    }

    /**
     * Create test API responses
     */
    static createApiResponse(success = true, data = null, message = null) {
        return {
            success,
            data,
            message,
            meta: {
                timestamp: new Date().toISOString(),
                test: true
            }
        };
    }

    /**
     * Create test error response
     */
    static createErrorResponse(error = 'Test error', statusCode = 400) {
        return {
            error,
            statusCode,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create validation error response
     */
    static createValidationError(field = 'email', message = 'is required') {
        return {
            success: false,
            message: 'Validation failed',
            meta: {
                errors: [
                    {
                        msg: `${field} ${message}`,
                        param: field,
                        location: 'body'
                    }
                ]
            }
        };
    }

    /**
     * Create mock database query results
     */
    static createDbResult(rows = [], rowCount = null) {
        return {
            rows,
            rowCount: rowCount !== null ? rowCount : rows.length,
            command: 'SELECT',
            fields: []
        };
    }

    /**
     * Create mock Ollama service response
     */
    static createOllamaResponse(overrides = {}) {
        return {
            success: true,
            classification: 'A test image classification result',
            model: 'moondream',
            prompt: 'What is in this image?',
            processingTime: 1500,
            ...overrides
        };
    }

    /**
     * Create mock Ollama status response
     */
    static createOllamaStatus(available = true) {
        return {
            service: {
                available,
                url: 'http://localhost:11434'
            },
            model: {
                name: 'moondream',
                available
            },
            configuration: {
                timeout: 60000,
                baseURL: 'http://localhost:11434',
                maxConcurrentRequests: 3,
                maxQueueSize: 10
            },
            queue: {
                currentRequests: 0,
                queuedRequests: 0,
                queueUtilization: '0%'
            }
        };
    }

    /**
     * Create test file upload data
     */
    static createFileUpload(filename = 'test.png', mimetype = 'image/png') {
        return {
            fieldname: 'image',
            originalname: filename,
            encoding: '7bit',
            mimetype,
            buffer: this.createImageBuffer(),
            size: 1024
        };
    }

    /**
     * Create mock request object
     */
    static createMockRequest(overrides = {}) {
        return {
            body: {},
            params: {},
            query: {},
            headers: {},
            user: { userId: 1, email: 'test@example.com' },
            ip: '127.0.0.1',
            method: 'GET',
            url: '/test',
            ...overrides
        };
    }

    /**
     * Create mock response object
     */
    static createMockResponse() {
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            cookie: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            headers: {}
        };
        return res;
    }

    /**
     * Create mock next function
     */
    static createMockNext() {
        return jest.fn();
    }

    /**
     * Sleep utility for async tests
     */
    static sleep(ms = 100) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate random test data
     */
    static random = {
        email: () => `test.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
        name: () => `Test User ${Math.random().toString(36).substring(7)}`,
        password: () => `TestPass${Math.floor(Math.random() * 1000)}`,
        string: (length = 10) => Math.random().toString(36).substring(2, 2 + length),
        number: (min = 1, max = 1000) => Math.floor(Math.random() * (max - min + 1)) + min,
        boolean: () => Math.random() < 0.5,
        hash: () => crypto.randomBytes(32).toString('hex')
    };
}

module.exports = TestDataFixtures;