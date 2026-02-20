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

# Install dependencies with aggressive cleanup
RUN npm ci --only=production=false && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/* /var/tmp/*

# Copy frontend source
COPY client/ ./

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

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy backend source
COPY server/src ./src

# Build backend TypeScript
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 3: Production Runtime
# ----------------------------------------------------------------------------
# Use node:20-slim (Debian Bookworm) instead of heavy Playwright base image
FROM node:20-slim AS production

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy backend package files and install production dependencies only
COPY server/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Install Playwright's Chromium headless shell + system dependencies
# --with-deps: Auto-installs all required system dependencies
# --only-shell: Installs lightweight headless shell (smaller, headless-only)
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright
RUN npx playwright install --with-deps --only-shell chromium

# Copy built backend from builder
COPY --from=backend-builder /app/server/dist ./dist

# Copy backend config files (cinemas.json)
COPY server/src/config ./dist/config

# Copy built frontend from builder
COPY --from=frontend-builder /app/client/dist ./public

# Change ownership to appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application using the built index file which handles DB init and cron
CMD ["node", "dist/index.js"]
