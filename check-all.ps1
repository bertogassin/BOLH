param(
    [switch]$SkipNpmInstall,
    [switch]$InstallCargoAudit,
    [switch]$RunCargoAudit,
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
