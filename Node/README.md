# 🤖 Node.js ApyHub Summarizer API

A production-grade Node.js API starter kit showcasing **Treblle** monitoring with **ApyHub's AI Summarization API** as the core feature. This project demonstrates best practices for REST API design, security, performance, and real-time monitoring.

## ✨ Features

- 🧠 **AI-Powered Text Summarization** using ApyHub API
- 📊 **Real-time API Monitoring** with Treblle
- 🔐 **JWT Authentication** with bcrypt password hashing
- 🛡️ **Production Security** (helmet, CORS, rate limiting, DDoS protection)
- 📈 **Performance Optimized** (compression, pagination, connection pooling)
- 🗄️ **PostgreSQL Database** with parameterized queries
- 📋 **Input Validation** and sanitization
- 🌐 **Modern Frontend** interface included
- 🚀 **Docker Ready** with health checks
- 📚 **Auto-Generated Documentation** via Treblle

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- PostgreSQL database
- ApyHub API key ([Get one here](https://apyhub.com))
- Treblle account ([Sign up here](https://treblle.com))

### 1. Clone and Install

```bash
git clone <repository-url>
cd nodejs-apyhub-summarizer
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgres://username:password@localhost:5432/treblle_demo

# JWT Configuration  
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Treblle Configuration
TREBLLE_API_KEY=your-treblle-api-key
TREBLLE_PROJECT_ID=your-treblle-project-id

# ApyHub Configuration
APYHUB_API_KEY=your-apyhub-api-key

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 3. Database Setup

Create a PostgreSQL database and update the `DATABASE_URL` in your `.env` file. The application will automatically create the required tables on startup.

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE treblle_demo;
CREATE USER treblle_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE treblle_demo TO treblle_user;

# Exit PostgreSQL
\q
```

#### For Windows Users (Git Bash/MINGW64/PowerShell)

```bash
# Connect to PostgreSQL (use default postgres user)
psql -U postgres

# Create database and user
CREATE DATABASE treblle_demo;
CREATE USER treblle_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE treblle_demo1 TO treblle_user;

# Exit PostgreSQL
\q
```

### 4. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### 5. Test with Frontend

Visit `http://localhost:3000` in your browser to use the included web interface.

## 🏗️ Architecture

```
nodejs-apyhub-summarizer/
├── app.js                 # Express app configuration
├── server.js              # Application entry point
├── routes/
│   ├── authRoutes.js      # Authentication endpoints
│   └── summarizeRoutes.js # Summarization endpoints
├── controllers/
│   ├── authController.js  # Auth business logic
│   └── summarizeController.js # Summarization logic
├── services/
│   └── apyhubService.js   # ApyHub API integration
├── middleware/
│   ├── authMiddleware.js  # JWT authentication
│   ├── rateLimit.js       # Rate limiting & DDoS protection
│   ├── ddos.js            # Slow-down middleware
│   └── errorHandler.js    # Global error handling
├── db/
│   └── db.js              # PostgreSQL connection & queries
├── public/
│   └── frontend.html      # Web interface
├── .env.example           # Environment variables template
├── Dockerfile             # Container configuration
├── vercel.json            # Vercel deployment config
└── README.md              # This file
```

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | ❌ |
| POST | `/auth/login` | Login user | ❌ |
| GET | `/auth/profile` | Get user profile | ✅ |
| POST | `/auth/refresh` | Refresh JWT token | ✅ |
| POST | `/auth/logout` | Logout user | ✅ |

### Summarization

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/summarize` | Summarize text | ✅ |
| POST | `/api/summarize-url` | Summarize URL content | ✅ |
| GET | `/api/history` | Get summarization history | ✅ |
| GET | `/api/options` | Get available options | ❌ |
| GET | `/api/health` | Service health check | ❌ |

### System

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | API health status | ❌ |
| GET | `/docs` | API documentation | ❌ |

## 🧪 Testing with cURL

### Register a User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "SecurePass123!"
  }'
```

### Summarize Text

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "text": "Your long text here...",
    "summaryLength": "medium",
    "outputLanguage": "en"
  }'
```

### Summarize URL

```bash
curl -X POST http://localhost:3000/api/summarize-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "url": "https://example.com/article",
    "summaryLength": "short"
  }'
```

## 🌐 Ngrok Setup (for external testing)

```bash
# Install ngrok globally
npm install -g ngrok

# Expose your local server
npx ngrok http 3000
```

This will provide a public URL like `https://abc123.ngrok.io` that you can use for testing webhooks or external integrations.

## 🐳 Docker Deployment

### Build and Run

```bash
# Build image
docker build -t apyhub-summarizer .

# Run container
docker run -p 3000:3000 --env-file .env apyhub-summarizer
```

## 📚 Additional Resources

### Treblle Resources

- [Treblle Documentation](https://docs.treblle.com)
- [Treblle Node.js SDK](https://github.com/Treblle/treblle-node)
- [Aspen API Testing Tool](https://treblle.com/product/aspen)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using Node.js, and Treblle**
