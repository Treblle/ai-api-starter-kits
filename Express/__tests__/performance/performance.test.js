const request = require('supertest');
const app = require('../../app');

describe('Performance Tests', () => {
    let authToken;

    beforeAll(async () => {
        // Create test user and get auth token
        const testUser = {
            email: `perf.test.${Date.now()}@example.com`,
            name: 'Performance Test User',
            password: 'TestPass123'
        };

        try {
            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(testUser);
            authToken = registerResponse.body.data?.token || global.testUtils.createTestToken();
        } catch (error) {
            // Fallback to mock token if registration fails
            authToken = global.testUtils.createTestToken();
        }
    });

    describe('API Response Times', () => {
        test('health check should respond within 100ms', async () => {
            const startTime = Date.now();

            await request(app)
                .get('/health')
                .expect(200);

            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(100);
        });

        test('auth endpoints should respond within 500ms', async () => {
            const startTime = Date.now();

            await request(app)
                .get('/api/v1/auth/test')
                .expect(200);

            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(500);
        });

        test('classification status should respond within 200ms', async () => {
            const startTime = Date.now();

            await request(app)
                .get('/api/v1/classify/status')
                .expect(200);

            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(200);
        });
    });

    describe('Concurrent Request Handling', () => {
        test('should handle 10 concurrent health checks', async () => {
            const requests = Array(10).fill().map(() =>
                request(app).get('/health').expect(200)
            );

            const startTime = Date.now();
            const responses = await Promise.all(requests);
            const totalTime = Date.now() - startTime;

            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            // Total time should be reasonable (not 10x single request time)
            expect(totalTime).toBeLessThan(1000);
        });

        test('should handle concurrent authentication requests', async () => {
            const requests = Array(5).fill().map(() =>
                request(app)
                    .get('/api/v1/auth/profile')
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const startTime = Date.now();
            const responses = await Promise.allSettled(requests);
            const totalTime = Date.now() - startTime;

            // Check that requests completed reasonably quickly
            expect(totalTime).toBeLessThan(2000);

            // Count successful responses (some may fail due to token issues)
            const successfulResponses = responses.filter(
                result => result.status === 'fulfilled' &&
                    (result.value.status === 200 || result.value.status === 401)
            );

            expect(successfulResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Memory Usage', () => {
        test('should not leak memory during multiple requests', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Make 50 requests
            for (let i = 0; i < 50; i++) {
                await request(app).get('/health').expect(200);
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Memory increase should be reasonable (less than 50MB)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        });
    });

    describe('Rate Limiting Performance', () => {
        test('should enforce rate limits efficiently', async () => {
            const startTime = Date.now();

            // Make requests up to the rate limit
            const requests = [];
            for (let i = 0; i < 15; i++) {
                requests.push(
                    request(app)
                        .get('/api/v1/classify/status')
                        .expect(response => {
                            expect([200, 429]).toContain(response.status);
                        })
                );
            }

            await Promise.all(requests);
            const totalTime = Date.now() - startTime;

            // Rate limiting shouldn't significantly slow down valid requests
            expect(totalTime).toBeLessThan(3000);
        });
    });

    describe('Large Payload Handling', () => {
        test('should handle large JSON payloads efficiently', async () => {
            const largePayload = {
                data: 'x'.repeat(100000), // 100KB string
                metadata: {
                    timestamp: new Date().toISOString(),
                    test: true
                }
            };

            const startTime = Date.now();

            const response = await request(app)
                .post('/api/v1/classify/image')
                .set('Authorization', `Bearer ${authToken}`)
                .send(largePayload)
                .expect(400); // Should fail validation but handle payload

            const responseTime = Date.now() - startTime;

            // Should process large payload quickly despite rejection
            expect(responseTime).toBeLessThan(1000);
            expect(response.body.error).toBe('No image provided');
        });
    });

    describe('Database Query Performance', () => {
        test('should handle database-dependent endpoints efficiently', async () => {
            if (process.env.SKIP_DB_TESTS) {
                return; // Skip if no database
            }

            const startTime = Date.now();

            // Test database-dependent endpoint
            await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(response => {
                    expect([200, 401, 404, 503]).toContain(response.status);
                });

            const responseTime = Date.now() - startTime;

            // Database queries should be reasonably fast
            expect(responseTime).toBeLessThan(2000);
        });
    });

    describe('Error Handling Performance', () => {
        test('should handle 404 errors efficiently', async () => {
            const startTime = Date.now();

            const requests = Array(20).fill().map(() =>
                request(app).get('/api/v1/nonexistent').expect(404)
            );

            await Promise.all(requests);
            const totalTime = Date.now() - startTime;

            // Error handling should be fast
            expect(totalTime).toBeLessThan(1000);
        });

        test('should handle validation errors efficiently', async () => {
            const startTime = Date.now();

            const requests = Array(10).fill().map(() =>
                request(app)
                    .post('/api/v1/auth/register')
                    .send({ invalid: 'data' })
                    .expect(400)
            );

            await Promise.all(requests);
            const totalTime = Date.now() - startTime;

            // Validation should be fast even with errors
            expect(totalTime).toBeLessThan(2000);
        });
    });

    describe('Stress Testing', () => {
        test('should maintain performance under load', async () => {
            const concurrency = 20;
            const requestsPerWorker = 5;

            const workers = Array(concurrency).fill().map(async () => {
                const workerRequests = [];
                for (let i = 0; i < requestsPerWorker; i++) {
                    workerRequests.push(
                        request(app).get('/health').expect(200)
                    );
                }
                return Promise.all(workerRequests);
            });

            const startTime = Date.now();
            await Promise.all(workers);
            const totalTime = Date.now() - startTime;

            // Should handle 100 total requests (20x5) reasonably quickly
            expect(totalTime).toBeLessThan(5000);
        }, 10000); // Extended timeout for stress test
    });

    describe('Resource Usage Monitoring', () => {
        test('should track performance metrics', () => {
            const metrics = {
                heapUsed: process.memoryUsage().heapUsed,
                heapTotal: process.memoryUsage().heapTotal,
                external: process.memoryUsage().external,
                cpuUsage: process.cpuUsage()
            };

            // Basic sanity checks
            expect(metrics.heapUsed).toBeGreaterThan(0);
            expect(metrics.heapTotal).toBeGreaterThan(metrics.heapUsed);
            expect(metrics.cpuUsage.user).toBeGreaterThanOrEqual(0);
            expect(metrics.cpuUsage.system).toBeGreaterThanOrEqual(0);

            console.log('📊 Performance Metrics:', {
                heapUsed: `${Math.round(metrics.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(metrics.heapTotal / 1024 / 1024)}MB`,
                external: `${Math.round(metrics.external / 1024 / 1024)}MB`,
                cpuUser: `${metrics.cpuUsage.user}μs`,
                cpuSystem: `${metrics.cpuUsage.system}μs`
            });
        });
    });
});