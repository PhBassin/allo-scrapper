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

# Accept build argument for app name (allows customization at build time)
ARG VITE_APP_NAME=Allo-Scrapper

WORKDIR /app/client

# Copy frontend package files
COPY client/package*.json ./

# Install dependencies with aggressive cleanup
RUN npm ci && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/* /var/tmp/*

# Copy frontend source
COPY client/ ./

# Set environment variable for Vite to substitute in index.html
ENV VITE_APP_NAME=${VITE_APP_NAME}

# Build frontend for production (source maps disabled in vite.config.ts)
RUN npm run build && \
    rm -rf node_modules/.cache node_modules/.vite

# ----------------------------------------------------------------------------
# Stage 2: Build Backend
# ----------------------------------------------------------------------------
FROM node:20-alpine AS backend-builder

WORKDIR /app/server

# Copy backend package files
COPY server/package*.json ./
COPY server/tsconfig.json ./

# Install dependencies (including dev dependencies for build) with aggressive cleanup
RUN npm ci && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/* /var/tmp/*

# Copy backend source
COPY server/src ./src

# Build backend TypeScript
RUN npm run build && \
    rm -rf node_modules/.cache

# Cleanup build artifacts in builder stage (source maps, declaration maps)
RUN find ./dist -name "*.map" -delete && \
    find ./dist -name "*.d.ts.map" -delete

# ----------------------------------------------------------------------------
# Stage 3: Production Runtime
# ----------------------------------------------------------------------------
# Use node:20-alpine (smaller image — no Playwright/Chromium needed)
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user BEFORE COPY operations (required for --chown)
RUN addgroup -S -g 1001 nodejs && \
    adduser -S -G nodejs -u 1001 nodejs

# Create /app directory with correct ownership BEFORE switching user
WORKDIR /app
RUN chown nodejs:nodejs /app

# Switch to nodejs user for npm install
USER nodejs

# Copy backend package files and install production dependencies only
COPY --chown=nodejs:nodejs server/package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/*

# Copy built backend from builder with correct ownership
COPY --from=backend-builder --chown=nodejs:nodejs /app/server/dist ./dist

# Copy backend config files (cinemas.json) with correct ownership
COPY --chown=nodejs:nodejs server/src/config ./dist/config

# Copy database migrations with correct ownership
COPY --chown=nodejs:nodejs migrations ./migrations

# Copy built frontend from builder with correct ownership
COPY --from=frontend-builder --chown=nodejs:nodejs /app/client/dist ./public

# Switch back to root for final cleanup
USER root

# Aggressive final cleanup: remove ALL unnecessary files
RUN find /app/dist -name "*.d.ts" -delete && \
    find /app/public -name "*.map" -delete && \
    find /app -name "*.test.js" -delete && \
    find /app -name "*.spec.js" -delete && \
    find /app -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Switch back to non-root user permanently
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application using the built index file which handles DB init and cron
CMD ["node", "dist/index.js"]
