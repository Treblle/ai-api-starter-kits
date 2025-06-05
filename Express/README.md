# 🚀 Treblle Express API Starter Kit

A **production-ready Express.js API** featuring PostgreSQL database integration, JWT authentication, comprehensive monitoring with [Treblle](https://treblle.com), and AI-powered image classification using [Ollama](https://ollama.com).

## ✨ Features

- 🗃️ **PostgreSQL Database** - Production-ready with connection pooling, migrations, and optimized queries
- 🔐 **JWT Authentication** - Secure user registration, login, and API key management
- 🛡️ **Enterprise Security** - Helmet, CORS, rate limiting, input validation, and DDoS protection
- 📊 **Real-time Monitoring** - Complete API observability with [Treblle integration](https://docs.treblle.com/integrations/javascript/express/)
- 🤖 **AI Image Classification** - Powered by [Ollama Moondream](https://ollama.com/library/moondream) for local image analysis
- 🚦 **Intelligent Rate Limiting** - Endpoint-specific limits based on resource requirements
- 📸 **Flexible Image Input** - Support for file uploads and base64 strings
- 🐳 **Docker Ready** - Containerized with health checks for consistent deployments
- 📚 **Auto Documentation** - Self-documenting API endpoints via [Treblle API Documentation](https://treblle.com/product/api-documentation)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **PostgreSQL 12+**
- **Ollama** installed and running
- **Treblle account** (get one at [treblle.com](https://treblle.com))

### 1. Clone and Install

```bash
git clone https://github.com/Treblle/express-api-starter-kit.git
cd express-api-starter-kit
npm install
```

### 2. Database Setup

```bash
# Install Homebrew (if not already installed)
[ -x "$(command -v brew)" ] || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql

# Start PostgreSQL as a background service
brew services start postgresql

# Add PostgreSQL to PATH (Apple Silicon)
echo 'export PATH="/opt/homebrew/opt/postgresql/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile

# Create database and user
psql postgres <<EOF
CREATE DATABASE treblle_api;
CREATE USER treblle_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE treblle_api TO treblle_user;
EOF
```

### 3. Environment Configuration

```bash
cp .env.example .env
```

Update `.env` with your credentials:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=treblle_api
DB_USER=treblle_user
DB_PASSWORD=secure_password
DB_POOL_MAX=20

# Treblle Configuration
TREBLLE_API_KEY=your_treblle_api_key_here
TREBLLE_PROJECT_ID=your_treblle_project_id_here

# Server Configuration  
PORT=3000
NODE_ENV=development

# JWT Configuration
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# Ollama Configuration
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=moondream
```

### 4. Start Ollama

```bash
# Pull the Moondream model
ollama pull moondream

# Verify it's running
ollama list
```

### 5. Start the API

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

🎉 **Your API is now running at <http://localhost:3000>**

---

## 🏗️ API Design & Architecture

This API follows **Treblle's 7 Key Lessons for Building Great REST APIs**, ensuring enterprise-grade quality and developer experience.

### Core Architecture Principles

#### 1. **Design** - RESTful Excellence

- **Resource-based URLs**: `/api/v1/users`, `/api/v1/classify/image`
- **HTTP Methods**: Proper GET, POST, PUT, DELETE usage
- **Status Codes**: Meaningful 2xx, 4xx, 5xx responses
- **API Versioning**: Future-proof with `/v1/` namespace

#### 2. **Security** - Multi-layered Protection

- **Authentication**: JWT tokens with configurable expiration
- **Authorization**: Role-based access control
- **Input Validation**: Express-validator with custom rules
- **Rate Limiting**: Endpoint-specific limits (5/15min for auth, 10/5min for AI)
- **Headers**: Helmet.js security headers
- **CORS**: Configurable cross-origin policies
- **DDoS Protection**: Express-slow-down middleware

#### 3. **Performance** - Optimized for Scale

- **Database**: Connection pooling with PostgreSQL
- **Compression**: Gzip compression for responses
- **Caching**: Strategic query optimization
- **Indexing**: Database indexes on frequently queried fields

#### 4. **Documentation** - Self-Documenting

- **Treblle Integration**: Automatic API documentation generation
- **OpenAPI Compatible**: Schema-first approach
- **Interactive Examples**: Live API testing capabilities

### Database Schema

```sql
-- Users table with authentication
users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Classifications table for AI results
classifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  image_hash VARCHAR(64) NOT NULL,
  image_size INTEGER NOT NULL,
  image_type VARCHAR(50) NOT NULL,
  prompt TEXT NOT NULL,
  result TEXT,
  confidence VARCHAR(20),
  model_used VARCHAR(100) NOT NULL,
  processing_time_ms INTEGER,
  status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking for analytics
api_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints

#### Authentication Endpoints

```http
POST   /api/v1/auth/register     # User registration
POST   /api/v1/auth/login        # User login
GET    /api/v1/auth/profile      # Get user profile
PUT    /api/v1/auth/profile      # Update profile
POST   /api/v1/auth/change-password  # Change password
POST   /api/v1/auth/regenerate-api-key  # Regenerate API key
```

#### Classification Endpoints

```http
POST   /api/v1/classify/image     # Classify image (AI)
GET    /api/v1/classify/status    # Service health & stats
GET    /api/v1/classify/history   # User's classification history
GET    /api/v1/classify/search    # Search classifications
GET    /api/v1/classify/samples   # API usage examples
DELETE /api/v1/classify/:id       # Delete classification
```

#### Utility Endpoints

```http
GET    /api/v1/health            # API health check
GET    /api/v1/stats             # System statistics (admin)
```

---

## 📊 Treblle Integration & Monitoring

### Real-time API Observability

The API automatically tracks **all requests** through Treblle, providing:

- 📈 **Performance Metrics** - Response times, error rates, throughput
- 🔍 **Request/Response Logging** - Complete payload inspection
- 🚨 **Error Tracking** - Detailed error analysis and alerting
- 📱 **User Behavior** - API usage patterns and trends
- 🌍 **Geographic Analytics** - Request distribution mapping

### Setup Treblle Monitoring

1. **Create Account**: Visit [treblle.com](https://treblle.com) and sign up
2. **Get API Keys**: Create a new project and copy your API key & Project ID
3. **Configure Environment**: Add keys to your `.env` file
4. **Deploy & Monitor**: Treblle automatically starts monitoring all API calls

```bash
# .env configuration
TREBLLE_API_KEY=your_treblle_api_key_here
TREBLLE_PROJECT_ID=your_treblle_project_id_here
```

The integration is zero-configuration. Restart your API and visit your Treblle dashboard to see live data flowing in.

---

## 📚 Usage Examples

### Authentication Flow

```bash
# 1. Register a new user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecurePass123!",
    "name": "Developer"
  }'
```

### Image Classification Examples

#### File Upload Method

```bash
# Classify an uploaded image file
curl -X POST http://localhost:3000/api/v1/classify/image \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@path/to/your/image.jpg" \
  -F "prompt=What type of wine glass is this?"
```

### Getting Classification History

```bash
# Get user's classification history
curl -X GET "http://localhost:3000/api/v1/classify/history?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Search classifications
curl -X GET "http://localhost:3000/api/v1/classify/search?q=wine+glass&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get specific classification
curl -X GET "http://localhost:3000/api/v1/classify/42" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔗 Resources

- **[Treblle](https://treblle.com)** - API Observability Platform
- **[Treblle Documentation](https://docs.treblle.com)** - Integration guides and API references
- **[Ollama](https://ollama.com)** - Local AI model runtime
- **[Moondream Model](https://ollama.com/library/moondream)** - Vision-language model
- **[Express.js](https://expressjs.com)** - Web framework documentation
- **[PostgreSQL](https://postgresql.org)** - Database documentation

---

*Built with ❤️ by the Treblle team. This starter kit demonstrates best practices for building production-ready APIs with comprehensive monitoring and AI capabilities.*
