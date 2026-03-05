#!/usr/bin/env bash
# One-command dev: start API Gateway + deps, then client-web.
cd "$(dirname "$0")/.."
echo "Starting Postgres, Redis, API Gateway..."
docker-compose up -d postgres redis api-gateway 2>/dev/null || docker compose up -d postgres redis api-gateway
sleep 3
echo "API Gateway: http://localhost:8080"
echo "Start client-web: cd guardian/client-web && npm run dev"
echo "Then open http://localhost:3003"
cd guardian/client-web && npm run dev
