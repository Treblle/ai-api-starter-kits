const axios = require('axios');

class OllamaService {
  constructor() {
    this.baseURL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'moondream';
    this.timeout = 60000; // 60 seconds

    // Request queue configuration
    this.maxConcurrentRequests = parseInt(process.env.OLLAMA_MAX_CONCURRENT) || 3;
    this.maxQueueSize = parseInt(process.env.OLLAMA_MAX_QUEUE_SIZE) || 10;
    this.currentRequests = 0;
    this.requestQueue = [];

    // Create axios instance with connection pooling
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      maxRedirects: 0,
      // Connection pooling settings
      maxSockets: this.maxConcurrentRequests,
      keepAlive: true,
      keepAliveMsecs: 30000,
      headers: {
        'Connection': 'keep-alive',
        'Content-Type': 'application/json'
      }
    });
  }

  // Request queue management
  async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        execute: requestFn,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Check if we can execute immediately
      if (this.currentRequests < this.maxConcurrentRequests) {
        this.executeRequest(queueItem);
      } else {
        // Check queue size limit
        if (this.requestQueue.length >= this.maxQueueSize) {
          reject(new Error('Request queue is full. Please try again later.'));
          return;
        }

        // Add to queue
        this.requestQueue.push(queueItem);
        console.log(`🚦 Request queued. Queue size: ${this.requestQueue.length}`);
      }
    });
  }

  async executeRequest(queueItem) {
    this.currentRequests++;

    try {
      const result = await queueItem.execute();
      queueItem.resolve(result);
    } catch (error) {
      queueItem.reject(error);
    } finally {
      this.currentRequests--;
      this.processQueue();
    }
  }

  processQueue() {
    if (this.requestQueue.length > 0 && this.currentRequests < this.maxConcurrentRequests) {
      const nextRequest = this.requestQueue.shift();

      // Check if request hasn't timed out while in queue
      const waitTime = Date.now() - nextRequest.timestamp;
      if (waitTime > 30000) { // 30 second queue timeout
        nextRequest.reject(new Error('Request timed out in queue'));
        this.processQueue(); // Try next request
        return;
      }

      console.log(`🚀 Processing queued request. Queue size: ${this.requestQueue.length}`);
      this.executeRequest(nextRequest);
    }
  }

  // Extract debug logging to separate function for better readability
  logResponseDebug(response) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 === RESPONSE DEBUG START ===');
      console.log('Response status:', response.status);
      console.log('Response data type:', typeof response.data);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      console.log('Response.data.response exists?:', 'response' in response.data);
      console.log('Response.data.response value:', response.data.response);
      console.log('Response.data.response type:', typeof response.data.response);
      console.log('All response.data keys:', Object.keys(response.data));
      console.log('🔍 === RESPONSE DEBUG END ===');
    }
  }

  // Enhanced error handling for network issues
  handleNetworkError(error) {
    // Handle specific timeout errors first
    if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
      throw new Error('Request to Ollama service timed out. The image might be too large or complex, or the service may be overloaded.');
    }

    // Handle connection refused (service not running)
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Ollama service. Please ensure Ollama is running and accessible at the configured URL.');
    }

    // Handle DNS/hostname resolution errors
    if (error.code === 'ENOTFOUND') {
      throw new Error('Ollama service URL not found. Please check your OLLAMA_API_URL configuration.');
    }

    // Handle network unreachable errors
    if (error.code === 'ENETUNREACH') {
      throw new Error('Network unreachable. Please check your network connection and Ollama service configuration.');
    }

    // Handle specific HTTP status codes
    if (error.response?.status === 404) {
      throw new Error('Ollama API endpoint not found. Please check your Ollama installation and version.');
    }

    if (error.response?.status === 400) {
      throw new Error(`Ollama API error: ${JSON.stringify(error.response.data)}`);
    }

    if (error.response?.status >= 500) {
      throw new Error('Ollama service is experiencing internal issues. Please try again later.');
    }

    // Generic network error fallback
    throw new Error(`Ollama service error: ${error.message}`);
  }

  // Check if Ollama service is available
  async isAvailable() {
    try {
      console.log(`🔍 Checking Ollama service at ${this.baseURL}/api/tags`);
      const response = await this.axiosInstance.get('/api/tags', {
        timeout: 5000
      });
      console.log(`✅ Ollama service is available, status: ${response.status}`);
      return response.status === 200;
    } catch (error) {
      console.error('❌ Ollama service check failed:', error.message);
      return false;
    }
  }

  // Check if the specified model is available
  async isModelAvailable() {
    try {
      console.log(`🔍 Checking if model '${this.model}' is available`);
      const response = await this.axiosInstance.get('/api/tags', {
        timeout: 5000
      });

      if (response.status === 200 && response.data.models) {
        const modelExists = response.data.models.some(model =>
          model.name.includes(this.model)
        );
        console.log(`${modelExists ? '✅' : '❌'} Model '${this.model}' ${modelExists ? 'found' : 'not found'}`);
        return modelExists;
      }
      return false;
    } catch (error) {
      console.error('❌ Model availability check failed:', error.message);
      return false;
    }
  }

  // Classify image using Ollama Moondream with request queuing
  async classifyImage(imageBase64, prompt = "What object is in this image? Provide a brief, descriptive answer.") {
    console.log(`🚀 Starting image classification with model: ${this.model}`);
    console.log(`📝 Prompt: ${prompt}`);
    console.log(`🖼️ Image size: ${Math.round(imageBase64.length / 1024)} KB (base64)`);
    console.log(`🚦 Current concurrent requests: ${this.currentRequests}/${this.maxConcurrentRequests}`);

    // Use request queue to prevent overwhelming Ollama service
    // This ensures we don't exceed the service's capacity
    return await this.queueRequest(async () => {
      try {
        // Pre-flight checks: Ensure Ollama service and model are available
        // These checks prevent unnecessary processing if the service is down
        const isServiceAvailable = await this.isAvailable();
        if (!isServiceAvailable) {
          throw new Error('Ollama service is not available. Please ensure Ollama is running.');
        }

        const isModelReady = await this.isModelAvailable();
        if (!isModelReady) {
          throw new Error(`Model '${this.model}' is not available. Please run: ollama pull ${this.model}`);
        }

        // Prepare the request payload for Ollama's /api/generate endpoint
        // Reference: https://github.com/ollama/ollama/blob/main/docs/api.md
        const payload = {
          // Model name - must match exactly what's available in Ollama
          model: this.model,

          // Text prompt that will be combined with the image for analysis
          prompt: prompt,

          // Array of base64-encoded images (Ollama supports multiple images)
          images: [imageBase64],

          // Disable streaming for simpler response handling
          stream: false,

          // Model parameters for controlling generation behavior
          options: {
            // Temperature (0.0-1.0): Lower values make output more deterministic
            // 0.1 is good for factual image classification
            temperature: 0.1,

            // Top-p sampling: Considers tokens with cumulative probability up to p
            // 0.9 provides good balance between creativity and consistency
            top_p: 0.9,

            // Top-k sampling: Only consider the k most likely tokens
            // 40 is a reasonable default for image classification tasks
            top_k: 40
          }
        };

        console.log(`📡 Making request to Ollama API: ${this.baseURL}/api/generate`);

        const startTime = Date.now();

        // Send POST request to Ollama's generate endpoint
        // Using the pooled axios instance for better connection management
        const response = await this.axiosInstance.post('/api/generate', payload);

        const processingTime = Date.now() - startTime;
        console.log(`⏱️ Processing time: ${processingTime}ms`);

        // Debug logging for development troubleshooting
        this.logResponseDebug(response);

        // Response validation: Ensure we received valid data
        if (!response.data) {
          throw new Error('Empty response from Ollama API');
        }

        if (response.status !== 200) {
          throw new Error(`Ollama API returned status ${response.status}: ${JSON.stringify(response.data)}`);
        }

        // Check for the main response field containing the classification result
        if (!response.data.hasOwnProperty('response')) {
          console.error('❌ Response object structure:', response.data);
          console.error('❌ Available keys:', Object.keys(response.data));
          throw new Error('Ollama API response is missing the "response" field');
        }

        if (response.data.response === undefined || response.data.response === null) {
          console.error('❌ Response field is null/undefined:', response.data.response);
          throw new Error('Ollama API response field is null or undefined');
        }

        // Build standardized result object
        const result = {
          success: true,
          // Clean up the classification text (remove extra whitespace)
          classification: String(response.data.response).trim(),
          model: this.model,
          prompt: prompt,
          // Convert Ollama's nanosecond timing to milliseconds, fallback to our timing
          processingTime: response.data.total_duration ?
            Math.round(response.data.total_duration / 1000000) : processingTime
        };

        console.log(`✅ Classification completed successfully`);
        console.log(`📊 Result: ${result.classification.substring(0, 100)}...`);

        return result;

      } catch (error) {
        console.error('❌ Ollama classification error:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          responseData: error.response?.data,
          stack: error.stack?.split('\n').slice(0, 5)
        });

        // Use enhanced error handling for different network conditions
        this.handleNetworkError(error);
      }
    });
  }

  // Get service status including queue information
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

module.exports = new OllamaService();