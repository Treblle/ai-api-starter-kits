require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const treblle = require('@treblle/express');
const database = require('./config/database');
const path = require('path');

// Import routes
const authRoutes = require('./auth/authRoutes');
const classifyRoutes = require('./routes/classifyRoutes');

// Import middleware
const { rateLimiter } = require('./middleware/rateLimit');
const { ddosProtection } = require('./middleware/ddos');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Debug Treblle configuration
console.log('🔧 Treblle Configuration Check:');
console.log('API Key:', process.env.TREBLLE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('Project ID:', process.env.TREBLLE_PROJECT_ID ? '✅ Set' : '❌ Missing');

// 1. DESIGN: Following REST principles with proper HTTP methods and response codes
// 2. SECURITY: Implementing multiple security layers

// Security middleware - Helmet for secure headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Add unsafe-inline for embedded scripts
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Initialize database connection with proper error handling
const initializeDatabase = async () => {
  try {
    await database.connect();
    console.log('✅ Database connection established successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);

    if (process.env.NODE_ENV === 'production') {
      console.error('💀 Database is required in production. Exiting...');
      process.exit(1);
    } else {
      console.warn('⚠️  Database unavailable in development mode');
      console.warn('📝 API will run with limited functionality');
      console.warn('🔧 Please check your database configuration and connection');

      // Set a flag to indicate database is unavailable
      app.locals.databaseAvailable = false;

      // Add middleware to handle database-dependent routes
      app.use('/api/v1/auth', (req, res, next) => {
        if (!app.locals.databaseAvailable) {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Database connection required for authentication',
            suggestion: 'Please check database configuration'
          });
        }
        next();
      });

      app.use('/api/v1/classify', (req, res, next) => {
        if (!app.locals.databaseAvailable && req.path !== '/status') {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Database connection required for classification storage',
            suggestion: 'Please check database configuration'
          });
        }
        next();
      });
    }
  }
};

// Initialize database
initializeDatabase().then(() => {
  if (app.locals.databaseAvailable === undefined) {
    app.locals.databaseAvailable = true;
  }
});

// CORS configuration with ngrok support
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001'
    ];

    // Allow ngrok domains
    if (!origin ||
      allowedOrigins.indexOf(origin) !== -1 ||
      (origin && origin.includes('.ngrok')) ||
      (origin && origin.includes('.ngrok-free.app'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 3. PERFORMANCE: Compression and optimization
app.use(compression());

// Serve static files from public directory
app.use(express.static('public'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting and DDoS protection
app.use(rateLimiter);
app.use(ddosProtection);

// Treblle monitoring - Real-time API observability
// Configure Treblle with better error handling
if (process.env.TREBLLE_API_KEY && process.env.TREBLLE_PROJECT_ID) {
  console.log('🚀 Initializing Treblle monitoring...');
  console.log('API Key (first 8 chars):', process.env.TREBLLE_API_KEY.substring(0, 8) + '...');
  console.log('Project ID:', process.env.TREBLLE_PROJECT_ID);

  try {
    app.use(treblle({
      apiKey: process.env.TREBLLE_API_KEY,
      projectId: process.env.TREBLLE_PROJECT_ID,
      additionalFieldsToMask: ['password', 'token', 'authorization', 'api_key'],
      debug: true, // Enable debug mode to see what's being sent
      showErrors: true, // Show errors if Treblle fails
      endpoint: 'https://rocknrolla.treblle.com', // Specify endpoint explicitly
    }));
    console.log('✅ Treblle monitoring initialized successfully');
  } catch (error) {
    console.error('❌ Treblle initialization failed:', error.message);
    console.error('❌ Full error:', error);
  }
} else {
  console.warn('⚠️  Treblle monitoring disabled - missing credentials');
  console.log('TREBLLE_API_KEY present:', !!process.env.TREBLLE_API_KEY);
  console.log('TREBLLE_PROJECT_ID present:', !!process.env.TREBLLE_PROJECT_ID);
}

// Health check endpoint with database status
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    database: {
      available: app.locals.databaseAvailable || false,
      status: app.locals.databaseAvailable ? 'connected' : 'unavailable'
    },
    treblle: {
      enabled: !!(process.env.TREBLLE_API_KEY && process.env.TREBLLE_PROJECT_ID),
      apiKey: process.env.TREBLLE_API_KEY ? 'Set' : 'Missing',
      projectId: process.env.TREBLLE_PROJECT_ID ? 'Set' : 'Missing'
    }
  });
});

// API versioning - Starting simple with v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/classify', classifyRoutes);

// 4. DOCUMENTATION: API info endpoint
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    name: 'Treblle Express Ollama Classifier API',
    version: '1.0.0',
    description: 'AI-powered image classification API with Ollama Moondream integration',
    documentation: 'https://docs.treblle.com',
    status: {
      database: app.locals.databaseAvailable ? 'available' : 'unavailable',
      limitations: app.locals.databaseAvailable ? [] : ['Authentication disabled', 'Classification storage disabled']
    },
    endpoints: {
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        profile: 'GET /api/v1/auth/profile'
      },
      classify: {
        image: 'POST /api/v1/classify/image',
        status: 'GET /api/v1/classify/status',
        samples: 'GET /api/v1/classify/samples'
      }
    },
    features: [
      'JWT Authentication',
      'Rate Limiting',
      'Image Classification with Ollama',
      'Treblle Monitoring',
      'Security Headers',
      'CORS Protection',
      'ngrok Support'
    ],
    monitoring: {
      treblle: !!(process.env.TREBLLE_API_KEY && process.env.TREBLLE_PROJECT_ID),
      dashboard: 'https://app.treblle.com'
    }
  });
});

// Serve the frontend - REPLACE the long embedded HTML with this simple route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404 errors
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: '/api/v1'
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;