#!/bin/bash
# Guardio Rapidos - Development Environment
# Starts all services for local development

set -e

PROJECT_ROOT=$(dirname "$(dirname "$(realpath "$0")")")

# Kill previous processes
cleanup() {
    echo "Shutting down services..."
    pkill -f "guardio-api" 2>/dev/null || true
    pkill -f "uvicorn" 2>/dev/null || true
}
trap cleanup EXIT

echo "🔧 Starting Guardio Development Environment"
echo "============================================"

# Start Go backend
start_go() {
    echo "[1/3] Starting Go API (port 8080)..."
    cd "$PROJECT_ROOT/backend_go"
    go run main.go &
}

# Start Python ML
start_ml() {
    echo "[2/3] Starting ML Service (port 8001)..."
    cd "$PROJECT_ROOT/ml_python"
    uvicorn main:app --port 8001 --reload &
}

# Start Flutter
start_flutter() {
    echo "[3/3] Starting Flutter..."
    cd "$PROJECT_ROOT/frontend_mobile"
    flutter run
}

# Main
start_go
sleep 2
start_ml
sleep 2
start_flutter

wait
