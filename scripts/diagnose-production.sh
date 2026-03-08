#!/bin/bash
# Production diagnostics script for 500 error debugging

echo "=== PRODUCTION DIAGNOSTICS ==="
echo ""

echo "1. Checking container status..."
docker compose ps

echo ""
echo "2. Checking ics-web logs (last 50 lines)..."
docker compose logs --tail=50 ics-web

echo ""
echo "3. Checking file permissions in /app/public..."
docker compose exec ics-web ls -la /app/public | head -20

echo ""
echo "4. Checking if index.html exists..."
docker compose exec ics-web test -f /app/public/index.html && echo "✅ index.html exists" || echo "❌ index.html NOT FOUND"

echo ""
echo "5. Checking current user inside container..."
docker compose exec ics-web whoami

echo ""
echo "6. Checking directory structure..."
docker compose exec ics-web ls -la /app

echo ""
echo "7. Testing API health endpoint..."
curl -s http://localhost:3000/api/health | jq . || curl -s http://localhost:3000/api/health

echo ""
echo "8. Testing static file access..."
curl -I http://localhost:3000/ | head -10

echo ""
echo "=== END DIAGNOSTICS ==="
