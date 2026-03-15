param(
    [switch]$SkipNpmInstall,
    [switch]$InstallCargoAudit,
    [switch]$RunCargoAudit,
    [switch]$SkipP0Smoke,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)][string]$Command
    )

    Write-Step $Name
    Write-Host "Dir: $Directory" -ForegroundColor DarkGray
    Write-Host "Cmd: $Command" -ForegroundColor DarkGray

    if ($DryRun) {
        return
    }

    Push-Location $Directory
    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Assert-CommandExists([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Invoke-P0Smoke {
    param(
        [Parameter(Mandatory = $true)][string]$ApiGatewayDir
    )

    Write-Step "P0 smoke (api-gateway)"
    Write-Host "Dir: $ApiGatewayDir" -ForegroundColor DarkGray
    Write-Host "Cmd: python scripts/p0_smoke.py --api-base http://localhost:8080 --admin-key <key>" -ForegroundColor DarkGray

    if ($DryRun) {
        return
    }

    Assert-CommandExists "curl"

    $pythonCmd = $null
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonCmd = "python"
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCmd = "py"
    } else {
        throw "Required command not found: python or py"
    }

    $adminKey = if ($env:P0_SMOKE_ADMIN_KEY) { $env:P0_SMOKE_ADMIN_KEY } else { "ci-admin-secret" }
    $startedLocally = $false
    $apiProcess = $null

    try {
        & curl -fsS "http://localhost:8080/health" *> $null
        if ($LASTEXITCODE -ne 0) {
            $startedLocally = $true
            $previousAppEnv = $env:APP_ENV
            $previousJwtSecret = $env:JWT_SECRET
            $previousAdminSecret = $env:ADMIN_SECRET
            $env:APP_ENV = "test"
            $env:JWT_SECRET = "ci-jwt-secret"
            $env:ADMIN_SECRET = $adminKey

            Push-Location $ApiGatewayDir
            try {
                $apiProcess = Start-Process -FilePath "go" -ArgumentList "run", "." -PassThru -NoNewWindow -RedirectStandardOutput "/tmp/bolh-api-gateway-p0.log" -RedirectStandardError "/tmp/bolh-api-gateway-p0.log" -WorkingDirectory $ApiGatewayDir
            } finally {
                Pop-Location
                $env:APP_ENV = $previousAppEnv
                $env:JWT_SECRET = $previousJwtSecret
                $env:ADMIN_SECRET = $previousAdminSecret
            }

            $healthy = $false
            for ($i = 0; $i -lt 60; $i++) {
                Start-Sleep -Seconds 1
                & curl -fsS "http://localhost:8080/health" *> $null
                if ($LASTEXITCODE -eq 0) {
                    $healthy = $true
                    break
                }
            }
            if (-not $healthy) {
                throw "API Gateway did not become healthy on http://localhost:8080/health"
            }
        }

        Push-Location $ApiGatewayDir
        try {
            & $pythonCmd scripts/p0_smoke.py --api-base http://localhost:8080 --admin-key $adminKey
            if ($LASTEXITCODE -ne 0) {
                throw "P0 smoke failed with exit code $LASTEXITCODE"
            }
        } finally {
            Pop-Location
        }
    } finally {
        if ($startedLocally -and $apiProcess -and -not $apiProcess.HasExited) {
            Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$guardianRoot = Join-Path $repoRoot "guardian"
$apiGatewayDir = Join-Path $guardianRoot "services/api-gateway"
$userServiceDir = Join-Path $guardianRoot "services/user-service"
$notificationServiceDir = Join-Path $guardianRoot "services/notification-service"
$matchingDir = Join-Path $guardianRoot "services/matching"
$orderServiceDir = Join-Path $guardianRoot "services/order-service"
$bidServiceDir = Join-Path $guardianRoot "services/bid-service"
$clientWebDir = Join-Path $guardianRoot "client-web"

if (-not (Test-Path $guardianRoot)) {
    throw "Guardian root not found: $guardianRoot"
}

Assert-CommandExists "go"
Assert-CommandExists "cargo"
Assert-CommandExists "npm"

if (-not (Get-Command staticcheck -ErrorAction SilentlyContinue)) {
    Write-Step "Installing staticcheck"
    if (-not $DryRun) {
        go install honnef.co/go/tools/cmd/staticcheck@latest
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install staticcheck"
        }
    }
}

Invoke-CheckedCommand -Name "Go fmt (api-gateway)" -Directory $apiGatewayDir -Command "go fmt ./..."
Invoke-CheckedCommand -Name "Go vet (api-gateway)" -Directory $apiGatewayDir -Command "go vet ./..."
Invoke-CheckedCommand -Name "Staticcheck (api-gateway)" -Directory $apiGatewayDir -Command "staticcheck ./..."
Invoke-CheckedCommand -Name "Go test (api-gateway)" -Directory $apiGatewayDir -Command "go test ./..."
if (-not $SkipP0Smoke) {
    Invoke-P0Smoke -ApiGatewayDir $apiGatewayDir
}

Invoke-CheckedCommand -Name "Go test (user-service)" -Directory $userServiceDir -Command "go test ./..."
Invoke-CheckedCommand -Name "Go test (notification-service)" -Directory $notificationServiceDir -Command "go test ./..."

Invoke-CheckedCommand -Name "Cargo fmt (matching)" -Directory $matchingDir -Command "cargo +stable fmt --check"
Invoke-CheckedCommand -Name "Cargo clippy (matching)" -Directory $matchingDir -Command "cargo +stable clippy --all-targets --all-features -- -D warnings"
Invoke-CheckedCommand -Name "Cargo test (matching)" -Directory $matchingDir -Command "cargo +stable test --all-features"

Invoke-CheckedCommand -Name "Cargo clippy (order-service)" -Directory $orderServiceDir -Command "cargo +stable clippy --all-targets --all-features -- -D warnings"
Invoke-CheckedCommand -Name "Cargo test (order-service)" -Directory $orderServiceDir -Command "cargo +stable test --all-features"

Invoke-CheckedCommand -Name "Cargo clippy (bid-service)" -Directory $bidServiceDir -Command "cargo +stable clippy --all-targets --all-features -- -D warnings"
Invoke-CheckedCommand -Name "Cargo test (bid-service)" -Directory $bidServiceDir -Command "cargo +stable test --all-features"

if ($InstallCargoAudit -or $RunCargoAudit) {
    Invoke-CheckedCommand -Name "Install cargo-audit" -Directory $repoRoot -Command "cargo install cargo-audit"
}
if ($RunCargoAudit) {
    Invoke-CheckedCommand -Name "Cargo audit (repo root)" -Directory $repoRoot -Command "cargo audit"
}

if (-not $SkipNpmInstall) {
    Invoke-CheckedCommand -Name "NPM ci (client-web)" -Directory $clientWebDir -Command "npm ci"
}
Invoke-CheckedCommand -Name "NPM lint (client-web)" -Directory $clientWebDir -Command "npm run lint"
Invoke-CheckedCommand -Name "NPM build (client-web)" -Directory $clientWebDir -Command "npm run build"

Write-Host ""
Write-Host "All checks finished successfully." -ForegroundColor Green
