#!/usr/bin/env bash
# Run client-web + api-gateway locally (Linux/macOS).
# Usage: ./guardian/scripts/run-local.sh
# Optional: export DATABASE_URL="postgres://user:pass@localhost:5432/guardian" for persistence.

set -e
GUARDIAN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$GUARDIAN_ROOT"

echo "Starting API Gateway (port 8080)..."
(cd services/api-gateway && go run .) &
API_PID=$!
sleep 2
if ! kill -0 $API_PID 2>/dev/null; then
  wait $API_PID || true
  exit 1
fi

echo "Starting client-web (port 3003)..."
(cd client-web && npm run dev) &
WEB_PID=$!
sleep 3

echo ""
echo "Ready. Open http://localhost:3003 (web) and http://localhost:8080/health (API)."
echo "Press Ctrl+C to stop."
trap "kill $API_PID $WEB_PID 2>/dev/null; exit 0" INT TERM
wait $API_PID $WEB_PID 2>/dev/null || true
