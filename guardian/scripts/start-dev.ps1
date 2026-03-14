# One-command dev: start API Gateway + deps, then client-web.
# Requires: Docker, Node in client-web
Set-Location $PSScriptRoot\..

Write-Host "Starting Postgres, Redis, API Gateway..."
docker-compose up -d postgres redis api-gateway 2>$null
if ($LASTEXITCODE -ne 0) {
    docker compose up -d postgres redis api-gateway 2>$null
}
Start-Sleep -Seconds 3

Write-Host "API Gateway: http://localhost:8080"
Write-Host "Start client-web: cd client-web && npm run dev"
Write-Host "Then open http://localhost:3003"
Set-Location client-web
npm run dev
