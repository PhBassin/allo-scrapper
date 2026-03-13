# ============================================================================
# Multi-Stage Dockerfile for Cinema Scraper
# ============================================================================
# Stage 1: Dependencies (Shared)
# Stage 2: Build Frontend (React + Vite)
# Stage 3: Build Backend (TypeScript)
# Stage 4: Production Runtime (Node.js with built assets)
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Dependencies
# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
# Copy workspace package files to allow correct dependency resolution
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY scraper/package.json ./scraper/

# Install all dependencies using legacy-peer-deps for React hooks ESLint plugin
RUN npm ci --legacy-peer-deps && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/* /var/tmp/*

# ----------------------------------------------------------------------------
# Stage 2: Build Frontend
# ----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

ARG VITE_APP_NAME=Allo-Scrapper
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy root files needed for workspaces
COPY package.json package-lock.json ./

# Copy client source
COPY client/ ./client/

ENV VITE_APP_NAME=${VITE_APP_NAME}

# Build frontend workspace
RUN npm run build --workspace=client && \
    rm -rf node_modules/.cache client/node_modules/.vite

# ----------------------------------------------------------------------------
# Stage 3: Build Backend
# ----------------------------------------------------------------------------
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy root files
COPY package.json package-lock.json ./

# Copy backend source
COPY server/ ./server/

# Build backend workspace
RUN npm run build --workspace=allo-scrapper-server && \
    rm -rf node_modules/.cache

# Cleanup build artifacts in builder stage
RUN find ./server/dist -name "*.map" -delete && \
    find ./server/dist -name "*.d.ts.map" -delete

# ----------------------------------------------------------------------------
# Stage 4: Production Runtime
# ----------------------------------------------------------------------------
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

RUN addgroup -S -g 1001 nodejs && \
    adduser -S -G nodejs -u 1001 nodejs

WORKDIR /app
RUN chown nodejs:nodejs /app

USER nodejs

# Copy package files for production install
COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs client/package.json ./client/
COPY --chown=nodejs:nodejs server/package.json ./server/
COPY --chown=nodejs:nodejs scraper/package.json ./scraper/

# Install only production dependencies for the server workspace
RUN npm ci --omit=dev --workspace=allo-scrapper-server --legacy-peer-deps && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/*

# The server workspace needs to run from its directory or the root
# We will run from the root and point to the server's dist

# Copy built backend from builder
COPY --from=backend-builder --chown=nodejs:nodejs /app/server/dist ./server/dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/server/src/config ./server/dist/config

# Copy database migrations
COPY --chown=nodejs:nodejs migrations ./migrations

# Copy built frontend from builder into server's public directory so it can serve it
COPY --from=frontend-builder --chown=nodejs:nodejs /app/client/dist ./server/public

USER root

# Aggressive final cleanup
RUN find /app/server/dist -name "*.d.ts" -delete && \
    find /app/server/public -name "*.map" -delete && \
    find /app -name "*.test.js" -delete && \
    find /app -name "*.spec.js" -delete || true

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]

# Start the application using workspace syntax or pointing to the built file
CMD ["node", "server/dist/index.js"]

