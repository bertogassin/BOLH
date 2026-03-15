#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/guardian/services/api-gateway"
WEB_DIR="$ROOT_DIR/guardian/client-web"
API_HEALTH_URL="http://localhost:8080/health"
WEB_URL="http://localhost:3003"
API_LOG="/tmp/bolh-api-gateway.log"
WEB_LOG="/tmp/bolh-client-web.log"

if [[ ! -d "$API_DIR" ]]; then
  echo "API gateway folder not found: $API_DIR" >&2
  exit 1
fi

if [[ ! -d "$WEB_DIR" ]]; then
  echo "Web client folder not found: $WEB_DIR" >&2
  exit 1
fi

for cmd in go npm curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
done

is_api_healthy() {
  curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1
}

is_web_running() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i :3003 -sTCP:LISTEN >/dev/null 2>&1
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :3003 )" | grep -q ":3003"
    return
  fi

  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | grep -q ":3003"
    return
  fi

  return 1
}

open_url() {
  local url="$1"
  if [[ -n "${BROWSER:-}" ]]; then
    "$BROWSER" "$url" >/dev/null 2>&1 || true
    return
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  fi
}

echo "Checking API Gateway..."
if ! is_api_healthy; then
  echo "Starting API Gateway in background..."
  (
    cd "$API_DIR"
    nohup go run . >"$API_LOG" 2>&1 &
  )

  for _ in {1..20}; do
    sleep 1
    if is_api_healthy; then
      break
    fi
  done
fi

if ! is_api_healthy; then
  echo "API Gateway did not become healthy on 8080. Check logs: $API_LOG" >&2
  exit 1
fi

echo "Checking client-web dependencies..."
if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  echo "node_modules not found, running npm install..."
  (
    cd "$WEB_DIR"
    npm install
  )
fi

if ! is_web_running; then
  echo "Starting client-web in background..."
  (
    cd "$WEB_DIR"
    nohup npm run dev >"$WEB_LOG" 2>&1 &
  )
  sleep 3
else
  echo "Client-web is already running on port 3003."
fi

echo "Opening $WEB_URL"
open_url "$WEB_URL"

echo "Done. API Gateway: $API_HEALTH_URL, Web: $WEB_URL"
