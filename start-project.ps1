$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Join-Path $root "guardian\services\api-gateway"
$webDir = Join-Path $root "guardian\client-web"
$apiHealthUrl = "http://localhost:8080/health"
$webUrl = "http://localhost:3003"

if (-not (Test-Path $apiDir)) {
    throw "API gateway folder not found: $apiDir"
}
if (-not (Test-Path $webDir)) {
    throw "Web client folder not found: $webDir"
}

function Test-ApiGatewayHealthy {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

Write-Host "Checking API Gateway..."
$apiHealthy = Test-ApiGatewayHealthy -Url $apiHealthUrl
if (-not $apiHealthy) {
    # If another process already occupies 8080, free that port first.
    $conn = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pidValue in $pids) {
            Write-Host "Stopping process on 8080 (PID: $pidValue)..."
            Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "Starting API Gateway in a new window..."
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$apiDir'; go run ."
    )

    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 1
        if (Test-ApiGatewayHealthy -Url $apiHealthUrl) {
            $apiHealthy = $true
            break
        }
    }
}

if (-not $apiHealthy) {
    throw "API Gateway did not become healthy on 8080. Check the API terminal logs."
}

Write-Host "Checking client-web dependencies..."
if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
    Write-Host "node_modules not found, running npm install..."
    Push-Location $webDir
    npm install
    Pop-Location
}

try {
    $existing = Test-NetConnection -ComputerName "localhost" -Port 3003 -WarningAction SilentlyContinue
    $isRunning = [bool]$existing.TcpTestSucceeded
} catch {
    $isRunning = $false
}

if (-not $isRunning) {
    Write-Host "Starting client-web in a new window..."
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$webDir'; npm run dev"
    )
    Start-Sleep -Seconds 3
} else {
    Write-Host "Client-web is already running on port 3003."
}

Write-Host "Opening $webUrl"
Start-Process $webUrl

Write-Host "Done. API Gateway: $apiHealthUrl, Web: $webUrl"
