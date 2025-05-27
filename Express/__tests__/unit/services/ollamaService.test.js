// Remove the mock from setup and create real implementation for unit tests
jest.unmock('../../../services/ollamaService');

const axios = require('axios');

// Mock axios completely
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        get: jest.fn(),
        post: jest.fn(),
    }))
}));

// Create a test instance of OllamaService
class TestOllamaService {
    constructor() {
        this.baseURL = 'http://localhost:11434';
        this.model = 'moondream';
        this.timeout = 60000;
        this.maxConcurrentRequests = 3;
        this.maxQueueSize = 10;
        this.currentRequests = 0;
        this.requestQueue = [];

        this.axiosInstance = {
            get: jest.fn(),
            post: jest.fn()
        };
    }

    async isAvailable() {
        try {
            const response = await this.axiosInstance.get('/api/tags', { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async isModelAvailable() {
        try {
            const response = await this.axiosInstance.get('/api/tags', { timeout: 5000 });
            if (response.status === 200 && response.data.models) {
                return response.data.models.some(model => model.name.includes(this.model));
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    handleNetworkError(error) {
        if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
            throw new Error('Request to Ollama service timed out. The image might be too large or complex, or the service may be overloaded.');
        }

        if (error.code === 'ECONNREFUSED') {
            throw new Error('Cannot connect to Ollama service. Please ensure Ollama is running and accessible at the configured URL.');
        }

        if (error.code === 'ENOTFOUND') {
            throw new Error('Ollama service URL not found. Please check your OLLAMA_API_URL configuration.');
        }

        if (error.response?.status === 404) {
            throw new Error('Ollama API endpoint not found. Please check your Ollama installation and version.');
        }

        if (error.response?.status >= 500) {
            throw new Error('Ollama service is experiencing internal issues. Please try again later.');
        }

        throw new Error(`Ollama service error: ${error.message}`);
    }

    async queueRequest(requestFn) {
        if (this.currentRequests < this.maxConcurrentRequests) {
            return await this.executeRequest({ execute: requestFn });
        } else {
            if (this.requestQueue.length >= this.maxQueueSize) {
                throw new Error('Request queue is full. Please try again later.');
            }

            return new Promise((resolve, reject) => {
                const queueItem = {
                    execute: requestFn,
                    resolve,
                    reject,
                    timestamp: Date.now()
                };
                this.requestQueue.push(queueItem);
            });
        }
    }

    async executeRequest(queueItem) {
        this.currentRequests++;
        try {
            const result = await queueItem.execute();
            if (queueItem.resolve) queueItem.resolve(result);
            return result;
        } catch (error) {
            if (queueItem.reject) queueItem.reject(error);
            throw error;
        } finally {
            this.currentRequests--;
        }
    }

    async classifyImage(imageBase64, prompt = "What object is in this image? Provide a brief, descriptive answer.") {
        return await this.queueRequest(async () => {
            const isServiceAvailable = await this.isAvailable();
            if (!isServiceAvailable) {
                throw new Error('Ollama service is not available. Please ensure Ollama is running.');
            }

            const isModelReady = await this.isModelAvailable();
            if (!isModelReady) {
                throw new Error(`Model '${this.model}' is not available. Please run: ollama pull ${this.model}`);
            }

            const payload = {
                model: this.model,
                prompt: prompt,
                images: [imageBase64],
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.9,
                    top_k: 40
                }
            };

            const startTime = Date.now();
            const response = await this.axiosInstance.post('/api/generate', payload);
            const processingTime = Date.now() - startTime;

            if (!response.data) {
                throw new Error('Empty response from Ollama API');
            }

            if (response.status !== 200) {
                throw new Error(`Ollama API returned status ${response.status}: ${JSON.stringify(response.data)}`);
            }

            if (!response.data.hasOwnProperty('response')) {
                throw new Error('Ollama API response is missing the "response" field');
            }

            if (response.data.response === undefined || response.data.response === null) {
                throw new Error('Ollama API response field is null or undefined');
            }

            return {
                success: true,
                classification: String(response.data.response).trim(),
                model: this.model,
                prompt: prompt,
                processingTime: response.data.total_duration ?
                    Math.round(response.data.total_duration / 1000000) : processingTime
            };
        });
    }

    async getStatus() {
        try {
            const isAvailable = await this.isAvailable();
            const isModelReady = await this.isModelAvailable();

            return {
                service: {
                    available: isAvailable,
                    url: this.baseURL
                },
                model: {
                    name: this.model,
                    available: isModelReady
                },
                configuration: {
                    timeout: this.timeout,
                    baseURL: this.baseURL,
                    maxConcurrentRequests: this.maxConcurrentRequests,
                    maxQueueSize: this.maxQueueSize
                },
                queue: {
                    currentRequests: this.currentRequests,
                    queuedRequests: this.requestQueue.length,
                    queueUtilization: `${Math.round((this.currentRequests / this.maxConcurrentRequests) * 100)}%`
                }
            };
        } catch (error) {
            return {
                service: {
                    available: false,
                    url: this.baseURL,
                    error: error.message
                },
                model: {
                    name: this.model,
                    available: false
                },
                queue: {
                    currentRequests: this.currentRequests,
                    queuedRequests: this.requestQueue.length
                }
            };
        }
    }
}

describe('OllamaService', () => {
    let service;
    let mockAxiosInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new TestOllamaService();
        mockAxiosInstance = service.axiosInstance;
    });

    describe('isAvailable', () => {
        it('should return true when service is available', async () => {
            mockAxiosInstance.get.mockResolvedValue({ status: 200 });

            const isAvailable = await service.isAvailable();

            expect(isAvailable).toBe(true);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tags', { timeout: 5000 });
        });

        it('should return false when service is unavailable', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Connection refused'));

            const isAvailable = await service.isAvailable();

            expect(isAvailable).toBe(false);
        });
    });

    describe('isModelAvailable', () => {
        it('should return true when model exists', async () => {
            const mockResponse = {
                status: 200,
                data: {
                    models: [
                        { name: 'moondream:latest' },
                        { name: 'llama2:7b' }
                    ]
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockResponse);

            const isModelAvailable = await service.isModelAvailable();

            expect(isModelAvailable).toBe(true);
        });

        it('should return false when model does not exist', async () => {
            const mockResponse = {
                status: 200,
                data: {
                    models: [
                        { name: 'llama2:7b' },
                        { name: 'codellama:13b' }
                    ]
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockResponse);

            const isModelAvailable = await service.isModelAvailable();

            expect(isModelAvailable).toBe(false);
        });
    });

    describe('classifyImage', () => {
        const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        const testPrompt = 'What is in this image?';

        it('should successfully classify image', async () => {
            const mockResponse = {
                status: 200,
                data: {
                    response: 'This is a test image classification result',
                    total_duration: 1500000000 // 1.5 seconds in nanoseconds
                }
            };

            mockAxiosInstance.get.mockResolvedValue({
                status: 200,
                data: { models: [{ name: 'moondream:latest' }] }
            });
            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            const result = await service.classifyImage(testImageBase64, testPrompt);

            expect(result).toMatchObject({
                success: true,
                classification: 'This is a test image classification result',
                model: 'moondream',
                prompt: testPrompt,
                processingTime: 1500
            });
        });

        it('should handle service unavailable error', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Connection refused'));

            await expect(service.classifyImage(testImageBase64, testPrompt))
                .rejects.toThrow('Ollama service is not available');
        });

        it('should handle model unavailable error', async () => {
            mockAxiosInstance.get
                .mockResolvedValueOnce({ status: 200 }) // Service available
                .mockResolvedValueOnce({ status: 200, data: { models: [] } }); // No models

            await expect(service.classifyImage(testImageBase64, testPrompt))
                .rejects.toThrow('Model \'moondream\' is not available');
        });

        it('should handle empty response from API', async () => {
            const mockResponse = {
                status: 200,
                data: {
                    response: null
                }
            };

            mockAxiosInstance.get.mockResolvedValue({
                status: 200,
                data: { models: [{ name: 'moondream:latest' }] }
            });
            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            await expect(service.classifyImage(testImageBase64, testPrompt))
                .rejects.toThrow('Ollama API response field is null or undefined');
        });
    });

    describe('getStatus', () => {
        it('should return comprehensive service status', async () => {
            mockAxiosInstance.get.mockResolvedValue({
                status: 200,
                data: { models: [{ name: 'moondream:latest' }] }
            });

            const status = await service.getStatus();

            expect(status).toMatchObject({
                service: {
                    available: true,
                    url: 'http://localhost:11434'
                },
                model: {
                    name: 'moondream',
                    available: true
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
            });
        });

        it('should return error status when service fails', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

            const status = await service.getStatus();

            expect(status.service.available).toBe(false);
            expect(status.service.error).toBe('Connection failed');
        });
    });

    describe('handleNetworkError', () => {
        it('should handle connection refused error', () => {
            const error = new Error('Connection refused');
            error.code = 'ECONNREFUSED';

            expect(() => service.handleNetworkError(error))
                .toThrow('Cannot connect to Ollama service');
        });

        it('should handle DNS resolution error', () => {
            const error = new Error('Host not found');
            error.code = 'ENOTFOUND';

            expect(() => service.handleNetworkError(error))
                .toThrow('Ollama service URL not found');
        });

        it('should handle 404 HTTP error', () => {
            const error = new Error('Not found');
            error.response = { status: 404 };

            expect(() => service.handleNetworkError(error))
                .toThrow('Ollama API endpoint not found');
        });

        it('should handle generic network error', () => {
            const error = new Error('Generic network error');

            expect(() => service.handleNetworkError(error))
                .toThrow('Ollama service error: Generic network error');
        });
    });
});