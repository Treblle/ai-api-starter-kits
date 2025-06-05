const axios = require('axios');

class ApyHubService {
    constructor() {
        this.apiKey = process.env.APYHUB_API_KEY;
        this.baseURL = 'https://api.apyhub.com';

        if (!this.apiKey) {
            console.warn('⚠️ APYHUB_API_KEY not found in environment variables');
        }

        // Configure axios instance
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000, // 30 second timeout
            headers: {
                'Content-Type': 'application/json',
                'apy-token': this.apiKey,
            },
        });

        // Request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                console.log(`🔄 ApyHub API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('❌ ApyHub API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor for logging and error handling
        this.client.interceptors.response.use(
            (response) => {
                console.log(`✅ ApyHub API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                console.error('❌ ApyHub API Response Error:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    url: error.config?.url,
                });
                return Promise.reject(this.handleApiError(error));
            }
        );
    }

    /**
     * Handle and normalize API errors
     */
    handleApiError(error) {
        if (error.response) {
            const { status, data } = error.response;

            switch (status) {
                case 400:
                    return new Error(`Invalid request: ${data?.error?.message || 'Bad request'}`);
                case 401:
                    return new Error('Invalid or missing ApyHub API key');
                case 403:
                    return new Error('Access denied to ApyHub API');
                case 429:
                    return new Error('ApyHub API rate limit exceeded. Please try again later.');
                case 500:
                    return new Error('ApyHub API internal server error');
                default:
                    return new Error(`ApyHub API error: ${status} - ${data?.error?.message || 'Unknown error'}`);
            }
        } else if (error.code === 'ECONNABORTED') {
            return new Error('ApyHub API request timeout. Please try again.');
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return new Error('Unable to connect to ApyHub API. Please check your internet connection.');
        }

        return new Error(`ApyHub API error: ${error.message}`);
    }

    /**
     * Summarize text using ApyHub AI
     * @param {string} text - Text to summarize (max ~12,000 words)
     * @param {string} summaryLength - 'short', 'medium', or 'long'
     * @param {string} outputLanguage - Language ISO code (default: 'en')
     * @returns {Promise<object>} - Summary result
     */
    async summarizeText(text, summaryLength = 'short', outputLanguage = 'en') {
        if (!this.apiKey) {
            console.warn('⚠️ No ApyHub API key found, using mock summarizer for testing');

            // Mock summarizer for testing
            const words = text.split(' ');
            let maxWords;
            switch (summaryLength) {
                case 'short': maxWords = 20; break;
                case 'medium': maxWords = 60; break;
                case 'long': maxWords = 100; break;
                default: maxWords = 20;
            }

            const summary = words.slice(0, Math.min(words.length, maxWords)).join(' ') +
                (words.length > maxWords ? '...' : '');

            return {
                summary: `[MOCK] ${summary}`,
                originalLength: text.length,
                summaryLength: summary.length,
                requestedLength: summaryLength,
                language: outputLanguage,
                processingTime: 'mock',
            };
        }

        if (!text || typeof text !== 'string') {
            throw new Error('Text is required and must be a string');
        }

        if (text.length < 10) {
            throw new Error('Text must be at least 10 characters long');
        }

        // Validate summary length
        const validLengths = ['short', 'medium', 'long'];
        if (!validLengths.includes(summaryLength)) {
            throw new Error(`Invalid summary length. Must be one of: ${validLengths.join(', ')}`);
        }

        // Estimate token count (rough approximation)
        const estimatedTokens = text.length / 4;
        if (estimatedTokens > 16000) {
            throw new Error('Text is too long. Maximum supported length is approximately 12,000 words.');
        }

        try {
            const requestData = {
                text: text.trim(),
                summary_length: summaryLength,
                output_language: outputLanguage,
            };

            console.log(`📝 Summarizing text: ${text.length} characters, ${summaryLength} length`);
            console.log(`🔑 Using API key: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
            console.log(`🌐 Full URL: ${this.baseURL}/ai/summarize-text`);
            console.log(`📤 Request data:`, JSON.stringify(requestData, null, 2));

            // Use the CORRECT endpoint that we tested
            const response = await this.client.post('/ai/summarize-text', requestData);

            // Handle different response formats
            let summary;
            if (response.data?.data?.summary) {
                summary = response.data.data.summary;
            } else if (response.data?.summary) {
                summary = response.data.summary;
            } else {
                console.log(`❌ Invalid response format:`, response.data);
                throw new Error('Invalid response format from ApyHub API');
            }

            console.log(`✅ Successfully got summary: ${summary.substring(0, 100)}...`);

            return {
                summary: summary,
                originalLength: text.length,
                summaryLength: summary.length,
                requestedLength: summaryLength,
                language: outputLanguage,
                processingTime: response.headers['x-response-time'] || 'unknown',
            };

        } catch (error) {
            console.error('❌ Text summarization failed:', error.message);
            console.error('❌ Error details:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers,
            });
            throw error;
        }
    }

    /**
     * Summarize URL using ApyHub AI
     * @param {string} url - URL to summarize
     * @param {string} summaryLength - 'short', 'medium', or 'long'
     * @param {string} outputLanguage - Language ISO code (default: 'en')
     * @returns {Promise<object>} - Summary result
     */
    async summarizeUrl(url, summaryLength = 'short', outputLanguage = 'en') {
        if (!this.apiKey) {
            throw new Error('ApyHub API key is required for URL summarization');
        }

        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }

        // Basic URL validation
        try {
            new URL(url);
        } catch (error) {
            throw new Error('Invalid URL format');
        }

        // Validate summary length
        const validLengths = ['short', 'medium', 'long'];
        if (!validLengths.includes(summaryLength)) {
            throw new Error(`Invalid summary length. Must be one of: ${validLengths.join(', ')}`);
        }

        try {
            const requestData = {
                url: url.trim(),
                summary_length: summaryLength,
                output_language: outputLanguage,
            };

            console.log(`🔗 Summarizing URL: ${url}, ${summaryLength} length`);

            const response = await this.client.post('/ai/summarize-url', requestData);

            // Handle different response formats
            let summary;
            if (response.data?.data?.summary) {
                summary = response.data.data.summary;
            } else if (response.data?.summary) {
                summary = response.data.summary;
            } else {
                console.log(`❌ Invalid response format:`, response.data);
                throw new Error('Invalid response format from ApyHub API');
            }

            return {
                summary: summary,
                sourceUrl: url,
                summaryLength: summary.length,
                requestedLength: summaryLength,
                language: outputLanguage,
                processingTime: response.headers['x-response-time'] || 'unknown',
            };

        } catch (error) {
            console.error('❌ URL summarization failed:', error.message);
            throw error;
        }
    }

    /**
     * Get supported languages for summarization
     * @returns {Array} - List of supported language codes and names
     */
    getSupportedLanguages() {
        return [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'it', name: 'Italian' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'pt_BR', name: 'Brazilian Portuguese' },
            { code: 'ru', name: 'Russian' },
            { code: 'zh', name: 'Chinese (Simplified)' },
            { code: 'zh_CN', name: 'Mandarin (Simplified)' },
            { code: 'ja', name: 'Japanese' },
            { code: 'ko', name: 'Korean' },
            { code: 'ar', name: 'Arabic' },
            { code: 'hi', name: 'Hindi' },
            { code: 'bn', name: 'Bengali' },
            { code: 'ur', name: 'Urdu' },
            { code: 'pa', name: 'Punjabi' },
            { code: 'gu', name: 'Gujarati' },
            { code: 'ta', name: 'Tamil' },
            { code: 'te', name: 'Telugu' },
            { code: 'kn', name: 'Kannada' },
            { code: 'ml', name: 'Malayalam' },
            { code: 'mr', name: 'Marathi' },
            { code: 'ne', name: 'Nepali' },
            { code: 'si', name: 'Sinhala' },
            { code: 'th', name: 'Thai' },
            { code: 'vi', name: 'Vietnamese' },
            { code: 'id', name: 'Indonesian' },
            { code: 'ms', name: 'Malay' },
            { code: 'nl', name: 'Dutch' },
            { code: 'sv', name: 'Swedish' },
            { code: 'da', name: 'Danish' },
            { code: 'no', name: 'Norwegian' },
            { code: 'fi', name: 'Finnish' },
            { code: 'pl', name: 'Polish' },
            { code: 'cs', name: 'Czech' },
            { code: 'sk', name: 'Slovak' },
            { code: 'hu', name: 'Hungarian' },
            { code: 'ro', name: 'Romanian' },
            { code: 'bg', name: 'Bulgarian' },
            { code: 'hr', name: 'Croatian' },
            { code: 'sr', name: 'Serbian' },
            { code: 'bs', name: 'Bosnian' },
            { code: 'sl', name: 'Slovene' },
            { code: 'mk', name: 'Macedonian' },
            { code: 'sq', name: 'Albanian' },
            { code: 'el', name: 'Greek' },
            { code: 'tr', name: 'Turkish' },
            { code: 'az', name: 'Azerbaijani' },
            { code: 'ka', name: 'Georgian' },
            { code: 'hy', name: 'Armenian' },
            { code: 'he', name: 'Hebrew' },
            { code: 'fa', name: 'Persian (Farsi)' },
            { code: 'ps', name: 'Pashto' },
            { code: 'sd', name: 'Sindhi' },
            { code: 'ks', name: 'Kashmiri' },
        ];
    }

    /**
     * Validate if a language code is supported
     * @param {string} languageCode - ISO language code
     * @returns {boolean} - Whether the language is supported
     */
    isLanguageSupported(languageCode) {
        const supportedCodes = this.getSupportedLanguages().map(lang => lang.code);
        return supportedCodes.includes(languageCode);
    }

    /**
     * Get API health status
     * @returns {Promise<object>} - API health information
     */
    async getApiHealth() {
        try {
            // Test API connectivity with a minimal request
            const testText = "This is a test.";
            await this.summarizeText(testText, 'short', 'en');

            return {
                status: 'healthy',
                apiKey: this.apiKey ? 'configured' : 'missing',
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                apiKey: this.apiKey ? 'configured' : 'missing',
                timestamp: new Date().toISOString(),
            };
        }
    }
}

module.exports = new ApyHubService();