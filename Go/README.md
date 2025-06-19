# LinkedInify API

LinkedInify is a hands-on API starter kit that demonstrates how to build a modern, production-ready API in Go. It's built around a fun AI tool that transforms your everyday text into an over-the-top, professional-sounding LinkedIn post.

This project is designed for developers who want a practical, real-world example of building APIs with best practices in mind.

## Features

This starter kit comes packed with features that are essential for any modern API:

- **AI Integration**: Uses the OpenAI SDK to perform text transformations.
- **Layered Architecture**: Clean separation of concerns (handler, service, repository).
- **JWT Authentication**: Secure endpoints using JSON Web Tokens.
- **API Observability**: Integrated with the [Treblle SDK](https://treblle.com/) for real-time monitoring and debugging.
- **Database Integration**: Uses PostgreSQL with `sqlc` for type-safe queries.
- **Configuration Management**: Simple configuration using environment variables.
- **Dockerized Environment**: Includes a `docker-compose.yml` for easy, one-command setup.
- **RESTful Best Practices**: Implements proper status codes, error handling, and routing.

## Getting Started

Getting the project running locally is simple, thanks to Docker.

### Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose
- Go (for running outside of Docker)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/linkedinify.git
cd linkedinify
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Now, open the `.env` file and fill in the required values:

- `DATABASE_DSN`: The default value should work with the provided Docker Compose setup.
- `JWT_SECRET`: Add a long, random string for signing JWTs.
- `OPENAI_TOKEN`: Your secret API key from OpenAI.
- `TREBLLE_API_KEY` & `TREBLLE_PROJECT_ID`: Your Treblle credentials. (You can get these from the [Treblle dashboard](https://app.treblle.com)).

### 3. Run with Docker Compose

The easiest way to get everything running (the Go API, PostgreSQL database, and the frontend) is with a single command:

```bash
docker-compose up --build
```

Your API will be running at `http://localhost:8080` and the frontend at `http://localhost:5173`.

## API Observability with Treblle

This project uses Treblle to automatically provide real-time observability into your API. Once you run the application and make a few API calls, you can visit your project on the [Treblle dashboard](https://app.treblle.com) to see:

- Every request and response, with sensitive data automatically masked.
- API performance metrics and error tracking.
- Auto-generated, always-up-to-date API documentation.

This is a powerful feature for debugging, monitoring, and understanding your API without writing any extra code.

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Authentication

- **Register**: `POST /auth/register`
- **Login**: `POST /auth/login`

### LinkedInify (Requires Authentication)

- **Transform Text**: `POST /posts`
- **Get History**: `GET /posts`

*For detailed request/response examples, see the `curl` commands below or check your Treblle dashboard for live documentation.*

## Frontend

The project includes a simple Vite-based frontend in the `/frontend` directory. If you run `docker-compose up`, it is automatically served on `http://localhost:5173`.

To run it manually:

```bash
cd frontend
npm install
npm run dev
```

## Testing with curl

First, register and log in to get a token.

```bash
# Register (only needs to be done once)
curl -X POST http://localhost:8080/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"password123"}'

# Login to get a token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"password123"}' | jq -r .token)

echo "Got token: $TOKEN"

# Transform Text
curl -X POST http://localhost:8080/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text":"I built a cool API."}'

# Get Transformation History
curl -X GET http://localhost:8080/api/v1/posts \
  -H "Authorization: Bearer $TOKEN"
