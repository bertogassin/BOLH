#!/bin/bash
# Guardio Full Stack Startup Script

echo "🚀 Starting Guardio Full Stack..."

# Step 1: Start Docker services
echo "📦 Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for services to be healthy
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 15

# Step 2: Run migrations
echo "🗄️  Running database migrations..."
cd guardio-v2/backend
cargo sqlx migrate run

# Step 3: Start backend
echo "🔧 Starting Rust Backend..."
cargo run --release &

# Step 4: Start frontend (in new terminal or background)
echo "🎨 Starting Frontend apps..."
cd ../..
pnpm run dev:all

echo "✅ All services started!"
echo "📱 Mobile: http://localhost:3000"
echo "🌐 Web: http://localhost:3001"
echo "🔌 Backend: http://localhost:8080"
