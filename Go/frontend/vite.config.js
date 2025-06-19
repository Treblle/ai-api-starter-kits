import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow connections from outside the container
    proxy: {
      // Proxy API requests to the Go backend
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => `/api/v1${path}`,
      },
      '/posts': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => `/api/v1${path}`,
      }
    }
  },
  build: {
    outDir: '../public', // Build to the public directory for the Go server to serve
    emptyOutDir: true,
  }
});
