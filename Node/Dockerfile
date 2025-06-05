# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy application code
COPY --chown=nodeuser:nodejs . .

# Remove development files
RUN rm -rf .env.example README.md *.md

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http=require('http'); \
    const options={hostname:'localhost',port:3000,path:'/health',timeout:2000}; \
    const req=http.request(options, (res)=>{process.exit(res.statusCode===200?0:1)}); \
    req.on('error',()=>process.exit(1)); req.end();"

# Start the application
CMD ["node", "server.js"]