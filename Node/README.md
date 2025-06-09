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
git clone https://github.com/Treblle/ai-api-starter-kits.git
cd ai-api-starter-kits/node
npm install
```

### 2. Database Setup

**Important:** Follow these steps carefully to set up PostgreSQL with proper permissions.

#### Step 1: Connect to PostgreSQL as superuser

```bash
# For Windows (Git Bash/MINGW64/PowerShell)
psql -U postgres

# For Linux/macOS
sudo -u postgres psql
```

#### Step 2: Create database and user with full permissions

```sql
-- Create a new user with a strong password
CREATE USER treblle_app WITH PASSWORD 'TreblleApp2024!';

-- Create a new database owned by the user
CREATE DATABASE treblle_summarizer OWNER treblle_app;

-- Grant all necessary privileges
GRANT ALL PRIVILEGES ON DATABASE treblle_summarizer TO treblle_app;

-- Connect to the new database to set up schema permissions
\c treblle_summarizer

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO treblle_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO treblle_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO treblle_app;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO treblle_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO treblle_app;

-- Verify the setup
\l treblle_summarizer
\du treblle_app

-- Exit PostgreSQL
\q
```

#### Step 3: Initialize the database tables

After setting up the database and user, run the initialization script:

```bash
node init-database.js
```

You should see:

```
🚀 Initializing database...
📅 Connected to PostgreSQL database
✅ Database tables initialized
✅ Database initialization completed successfully
```

### 3. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgres://treblle_app:TreblleApp2024!@localhost:5432/treblle_summarizer

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

**Note:** If you used different database credentials in Step 2, update the `DATABASE_URL` accordingly.

### 4. Start Development Server

```bash
npm run dev
```

You should see:

```
🚀 Server running on port 3000
📊 Treblle monitoring active
🔗 Local: http://localhost:3000
🌐 To expose via ngrok: npx ngrok http 3000
📅 Connected to PostgreSQL database
✅ Database tables initialized
```

The API will be available at `http://localhost:3000`

### 5. Test with Frontend

Visit `http://localhost:3000` in your browser to use the included web interface.

## 🔧 Troubleshooting

### Database Permission Issues

If you encounter "permission denied for schema public" errors:

1. **Clean up existing database and users:**

```bash
psql -U postgres
```

```sql
-- Remove any existing project databases and users
DROP DATABASE IF EXISTS treblle_demo;
DROP DATABASE IF EXISTS treblle_demo5;
DROP USER IF EXISTS treblle_user;
DROP USER IF EXISTS treblle_user6;

-- Follow the database setup steps above
```

2. **Verify permissions:**

```sql
-- Connect to your database
\c treblle_summarizer

-- Check user permissions
\du treblle_app

-- Check database ownership
\l treblle_summarizer
```

### Common Database Setup Errors

- **"role cannot be dropped because some objects depend on it"**: Run the cleanup commands in the troubleshooting section above
- **"database does not exist"**: Make sure you created the database with the exact name used in your `.env` file
- **"authentication failed"**: Verify your password in the `DATABASE_URL` matches what you set when creating the user

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
├── init-database.js       # Database table initialization script
├── public/
│   └── index.html         # Web interface
├── .env.example           # Environment variables template
├── Dockerfile             # Container configuration
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

### ApyHub Resources

- [ApyHub Documentation](https://apyhub.com/docs)
- [ApyHub API Reference](https://apyhub.com/docs/api)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using Node.js, ApyHub, and Treblle**
