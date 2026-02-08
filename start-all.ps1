# Guardio Full Stack Startup Script for Windows PowerShell

Write-Host "🚀 Starting Guardio Full Stack..." -ForegroundColor Cyan

# Step 1: Check Docker
Write-Host "🐳 Checking Docker..." -ForegroundColor Yellow
if (-not (docker ps 2>$null)) {
    Write-Host "❌ Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "   Please open Docker Desktop and wait for the green status light" -ForegroundColor Yellow
    exit 1
}

# Step 2: Start Docker services
Write-Host "📦 Starting PostgreSQL and Redis..." -ForegroundColor Yellow
docker-compose up -d postgres redis

# Wait for services to be healthy
Write-Host "⏳ Waiting for PostgreSQL (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 3: Run migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Yellow
Push-Location guardio-v2/backend
cargo sqlx migrate run
Pop-Location

# Step 4: Start backend
Write-Host "🔧 Starting Rust Backend on port 8080..." -ForegroundColor Yellow
Start-Job -ScriptBlock {
    Set-Location 'C:\Users\Amir\Desktop\Guardio\guardio-v2\backend'
    cargo run --release
}

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Step 5: Start frontend
Write-Host "🎨 Starting Frontend apps..." -ForegroundColor Yellow
Push-Location guardio-v2
pnpm run dev:web
Pop-Location

Write-Host "`n✅ All services starting!" -ForegroundColor Green
Write-Host "📱 Mobile:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "🌐 Web:     http://localhost:3001" -ForegroundColor Cyan
Write-Host "🔌 Backend: http://localhost:8080" -ForegroundColor Cyan
