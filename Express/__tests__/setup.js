// Test setup and configuration
require('dotenv').config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
};

// Set test timeout
jest.setTimeout(30000);

// Mock Treblle to avoid external calls during tests
jest.mock('@treblle/express', () => {
    return jest.fn(() => (req, res, next) => next());
});

// Mock Ollama service calls
jest.mock('../services/ollamaService', () => ({
    classifyImage: jest.fn().mockResolvedValue({
        success: true,
        classification: 'Test classification result',
        model: 'moondream',
        prompt: 'Test prompt',
        processingTime: 1000
    }),
    getStatus: jest.fn().mockResolvedValue({
        service: { available: true, url: 'http://localhost:11434' },
        model: { name: 'moondream', available: true },
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
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
    isModelAvailable: jest.fn().mockResolvedValue(true)
}));

// Global test utilities
global.testUtils = {
    // Create test user data
    createTestUser: () => ({
        email: `test${Date.now()}@example.com`,
        name: 'Test User',
        password: 'TestPass123'
    }),

    // Create test JWT token
    createTestToken: (userId = 1, email = 'test@example.com') => {
        const jwt = require('jsonwebtoken');
        return jwt.sign(
            { userId, email },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    },

    // Create test image buffer
    createTestImageBuffer: () => {
        // Simple 1x1 PNG image as buffer
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
    },

    // Cleanup test data
    cleanup: async () => {
        // Add cleanup logic if needed
    }
};

// Cleanup after all tests
afterAll(async () => {
    await global.testUtils.cleanup();
});