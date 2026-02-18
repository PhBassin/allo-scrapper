# ============================================================================
# Multi-Stage Dockerfile for Cinema Scraper
# ============================================================================
# Stage 1: Build Frontend (React + Vite)
# Stage 2: Build Backend (TypeScript)
# Stage 3: Production Runtime (Node.js with built assets)
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Build Frontend
# ----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy frontend package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy frontend source
COPY client/ ./

# Build frontend for production
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 2: Build Backend
# ----------------------------------------------------------------------------
FROM node:20-alpine AS backend-builder

WORKDIR /app/server

# Copy backend package files
COPY server/package*.json ./
COPY server/tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy backend source
COPY server/src ./src

# Build backend TypeScript
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 3: Production Runtime
# ----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy backend package files and install production dependencies only
COPY server/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built backend from builder
COPY --from=backend-builder /app/server/dist ./dist

# Copy backend config files (cinemas.json)
COPY server/src/config ./dist/config

# Copy built frontend from builder
COPY --from=frontend-builder /app/client/dist ./public

# Create a simple server.js that starts the Express app
RUN cat > server.js << 'EOF'
import { createApp } from './dist/app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API: http://0.0.0.0:${PORT}/api`);
  console.log(`🌐 Frontend: http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
EOF

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
