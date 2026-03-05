# Run client-web + api-gateway locally (Windows PowerShell).
# Usage: .\guardian\scripts\run-local.ps1
# Optional: $env:DATABASE_URL = "postgres://user:pass@localhost:5432/guardian" for persistence.

$ErrorActionPreference = "Stop"
$guardianRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Start API Gateway in background
Write-Host "Starting API Gateway (port 8080)..." -ForegroundColor Cyan
$apiJob = Start-Job -ScriptBlock {
    Set-Location $using:guardianRoot
    Set-Location "services\api-gateway"
    go run .
}

Start-Sleep -Seconds 2
if ($apiJob.State -ne "Running") {
    Receive-Job $apiJob
    throw "API Gateway failed to start"
}

# Start client-web in background
Write-Host "Starting client-web (port 3003)..." -ForegroundColor Cyan
$webJob = Start-Job -ScriptBlock {
    Set-Location $using:guardianRoot
    Set-Location "client-web"
    npm run dev
}

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "Ready. Open http://localhost:3003 (web) and http://localhost:8080/health (API)." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop. Jobs: API Gateway = $($apiJob.Id), client-web = $($webJob.Id)" -ForegroundColor Gray
Write-Host ""

try {
    Wait-Job -Id $apiJob.Id, $webJob.Id
} finally {
    Stop-Job -Id $apiJob.Id, $webJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $apiJob.Id, $webJob.Id -Force -ErrorAction SilentlyContinue
}
