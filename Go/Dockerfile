# Build stage
FROM golang:1.22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./


# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o linkedinify ./cmd/api

# Final stage
FROM alpine:latest

# Install required packages
RUN apk --no-cache add ca-certificates

# Set working directory
WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/linkedinify .
# Copy migrations
COPY --from=builder /app/migrations ./migrations

# Expose the application port
EXPOSE 8080

# Command to run the application
CMD ["./linkedinify"]