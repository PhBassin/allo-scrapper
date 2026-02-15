# Use Node Alpine
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Environment variables will be passed by Docker Compose at runtime
# We don't need ARG here for runtime execution

# Expose port
EXPOSE 8080

# The command to run when the container starts
# We use a shell command to chain operations:
# 1. Initialize DB (schema)
# 2. Scrape data
# 3. Build the site
# 4. Serve the site (using host 0.0.0.0 to be accessible outside container)
CMD ["sh", "-c", "npm run db:migrate && npm run scrape && npm run build && npm run preview -- --host 0.0.0.0 --port 8080"]
