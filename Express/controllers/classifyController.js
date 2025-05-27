const { validationResult } = require('express-validator');
const crypto = require('crypto');
const ollamaService = require('../services/ollamaService');
const Classification = require('../models/Classification');
const User = require('../models/User');
const database = require('../config/database');

// Classify image endpoint
const classifyImage = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const startTime = Date.now();
    let imageBase64;
    let imageBuffer;
    let prompt = req.body.prompt || "What object is in this image? Provide a brief, descriptive answer.";

    // Handle different input methods
    if (req.file) {
      // File upload via multer
      imageBuffer = req.file.buffer;
      imageBase64 = imageBuffer.toString('base64');
    } else if (req.body.image) {
      // Base64 string from request body
      if (req.body.image.startsWith('data:image/')) {
        // Remove data URL prefix if present
        imageBase64 = req.body.image.split(',')[1];
      } else {
        imageBase64 = req.body.image;
      }
      imageBuffer = Buffer.from(imageBase64, 'base64');
    } else {
      return res.status(400).json({
        error: 'No image provided',
        message: 'Please provide an image either as a file upload or base64 string'
      });
    }

    // Validate base64 string
    if (!imageBase64 || imageBase64.length === 0) {
      return res.status(400).json({
        error: 'Invalid image data',
        message: 'The provided image data is empty or invalid'
      });
    }

    // Generate image hash for deduplication and tracking
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

    // Get image info
    const imageSize = imageBuffer.length;
    const imageType = req.file ? req.file.mimetype : 'image/jpeg'; // Default fallback

    console.log(`Processing image classification for user: ${req.user.email} (Hash: ${imageHash.substring(0, 8)}...)`);

    // Use database transaction to prevent race conditions
    const result = await database.transaction(async (client) => {
      // Create initial classification record with 'processing' status
      const classificationRecord = await Classification.create({
        userId: req.user.userId,
        imageHash,
        imageSize,
        imageType,
        prompt,
        result: null,
        confidence: null,
        modelUsed: process.env.OLLAMA_MODEL || 'moondream',
        processingTimeMs: null,
        status: 'processing'
      });

      let ollamaResult;
      try {
        // Call Ollama service
        ollamaResult = await ollamaService.classifyImage(imageBase64, prompt);

        const processingTime = Date.now() - startTime;

        // Update classification record with results in the same transaction
        await client.query(
          'UPDATE classifications SET result = $1, confidence = $2, processing_time_ms = $3, status = $4 WHERE id = $5',
          [ollamaResult.classification, 'High', processingTime, 'completed', classificationRecord.id]
        );

        console.log(`✅ Classification completed in ${processingTime}ms for user: ${req.user.email}`);

        return {
          success: true,
          result: {
            classification: ollamaResult.classification,
            confidence: 'High',
            detectedObjects: ollamaResult.classification,
            model: ollamaResult.model,
            prompt: ollamaResult.prompt
          },
          metadata: {
            processingTime: `${processingTime}ms`,
            ollamaProcessingTime: ollamaResult.processingTime ? `${ollamaResult.processingTime}ms` : null,
            userId: req.user.userId,
            classificationId: classificationRecord.id,
            timestamp: new Date().toISOString(),
            imageSize: `${Math.round(imageSize / 1024)} KB`,
            imageHash: imageHash.substring(0, 16) // Partial hash for reference
          }
        };

      } catch (ollamaError) {
        // Update classification record with error status in the same transaction
        await client.query(
          'UPDATE classifications SET status = $1, error_message = $2 WHERE id = $3',
          ['error', ollamaError.message, classificationRecord.id]
        );

        throw ollamaError;
      }
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('Classification error:', error.message);

    // Handle specific Ollama service errors
    if (error.message.includes('Ollama service')) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: error.message,
        suggestion: 'Please ensure Ollama is running and the model is available'
      });
    }

    if (error.message.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'Image processing took too long. Try with a smaller image.',
        suggestion: 'Reduce image size or complexity'
      });
    }

    next(error);
  }
};

// Get classification service status
const getStatus = async (req, res, next) => {
  try {
    const status = await ollamaService.getStatus();

    // Get some basic stats
    const stats = await Classification.getStats();
    const modelStats = await Classification.getModelStats();

    res.status(200).json({
      service: 'Image Classification API',
      status: status.service.available && status.model.available ? 'healthy' : 'degraded',
      ollama: status,
      statistics: {
        total_classifications: stats.total_classifications,
        success_rate: `${stats.success_rate}%`,
        avg_processing_time: `${stats.avg_processing_time}ms`,
        last_24h: stats.last_24h
      },
      models: modelStats,
      capabilities: {
        supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
        inputMethods: ['file upload', 'base64 string'],
        maxImageSize: '10MB',
        customPrompts: true
      },
      usage: {
        endpoint: '/api/v1/classify/image',
        method: 'POST',
        authentication: 'Bearer token required',
        rateLimit: '10 requests per 5 minutes'
      }
    });

  } catch (error) {
    next(error);
  }
};

// Get user's classification history
const getHistory = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;

    const classifications = await Classification.findByUserId(
      req.user.userId,
      {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status: status || null
      }
    );

    res.status(200).json({
      classifications: classifications.map(c => c.toSafeObject()),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: classifications.length === parseInt(limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

// Get specific classification by ID
const getClassification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classification = await Classification.findById(id);

    if (!classification) {
      return res.status(404).json({
        error: 'Classification not found'
      });
    }

    // Check if user owns this classification
    if (classification.user_id !== req.user.userId && req.user.email !== 'admin@treblle.com') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own classifications'
      });
    }

    res.status(200).json({
      classification: classification.toSafeObject()
    });

  } catch (error) {
    next(error);
  }
};

// Delete classification
const deleteClassification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classification = await Classification.findById(id);

    if (!classification) {
      return res.status(404).json({
        error: 'Classification not found'
      });
    }

    // Check if user owns this classification
    if (classification.user_id !== req.user.userId && req.user.email !== 'admin@treblle.com') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own classifications'
      });
    }

    await classification.delete();

    res.status(200).json({
      message: 'Classification deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};

// Search classifications
const searchClassifications = async (req, res, next) => {
  try {
    const { q: searchTerm, limit = 20, offset = 0 } = req.query;

    if (!searchTerm || searchTerm.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid search term',
        message: 'Search term must be at least 3 characters long'
      });
    }

    const classifications = await Classification.search(
      searchTerm.trim(),
      {
        userId: req.user.userId,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    );

    res.status(200).json({
      searchTerm,
      classifications: classifications.map(c => c.toSafeObject()),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: classifications.length === parseInt(limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

// Get sample classification requests
const getSamples = async (req, res) => {
  res.status(200).json({
    examples: {
      fileUpload: {
        method: 'POST',
        url: '/api/v1/classify/image',
        headers: {
          'Authorization': 'Bearer <your-token>',
          'Content-Type': 'multipart/form-data'
        },
        body: 'FormData with "image" field containing the image file'
      },
      base64Upload: {
        method: 'POST',
        url: '/api/v1/classify/image',
        headers: {
          'Authorization': 'Bearer <your-token>',
          'Content-Type': 'application/json'
        },
        body: {
          image: 'data:image/jpeg;base64,<base64-string>',
          prompt: 'What type of glass is this? Be specific about the style and purpose.'
        }
      }
    },
    samplePrompts: [
      "What object is in this image?",
      "Describe the main subject of this image in detail.",
      "What type of glass or container is shown?",
      "Identify the objects and their colors in this image.",
      "What is the style and purpose of this item?",
      "Describe the scene and atmosphere in this image.",
      "What materials are visible in this image?"
    ],
    tips: [
      "Use clear, well-lit images for best results",
      "Supported formats: JPEG, PNG, GIF, WebP",
      "Maximum file size: 10MB",
      "Custom prompts can improve classification accuracy",
      "Processing time varies based on image complexity",
      "All classifications are saved to your history"
    ],
    endpoints: {
      classify: 'POST /api/v1/classify/image',
      history: 'GET /api/v1/classify/history',
      search: 'GET /api/v1/classify/search?q=<search-term>',
      status: 'GET /api/v1/classify/status'
    }
  });
};

module.exports = {
  classifyImage,
  getStatus,
  getHistory,
  getClassification,
  deleteClassification,
  searchClassifications,
  getSamples
};