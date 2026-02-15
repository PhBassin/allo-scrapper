#!/bin/bash
# Pull latest Docker image and restart containers
# Usage: ./scripts/pull-and-deploy.sh [tag]

set -e

TAG="${1:-latest}"
REGISTRY="ghcr.io/phbassin/allo-scrapper"

echo "🔄 Pulling Docker image: ${REGISTRY}:${TAG}"
docker pull "${REGISTRY}:${TAG}"

echo "🔄 Stopping current containers..."
docker compose down

echo "🚀 Starting updated containers..."
docker compose up -d

echo "⏳ Waiting for services to be healthy..."
sleep 5

echo "🔍 Checking container status..."
docker compose ps

echo ""
echo "✅ Deployment updated successfully!"
echo ""
echo "📊 Quick health check:"
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "  ✓ API is responding"
    curl -s http://localhost:3000/api/health | jq
else
    echo "  ✗ API not responding yet (may still be starting up)"
fi

echo ""
echo "📝 View logs with: docker compose logs -f web"
