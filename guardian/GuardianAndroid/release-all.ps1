param(
  [string]$EnvFile = ".\release-signing.local.env",
  [switch]$SkipPreflight
)

$ErrorActionPreference = "Stop"
$releaseFolder = ".\app\build\outputs\bundle\release"

if (-not $SkipPreflight) {
  Write-Host "Step 1/3: Preflight checks" -ForegroundColor Cyan
  .\preflight-release.ps1 -EnvFile $EnvFile
}

Write-Host "Step 2/3: Build release bundle" -ForegroundColor Cyan
.\build-release.ps1 -EnvFile $EnvFile

Write-Host "Step 3/3: Open release folder" -ForegroundColor Cyan
if (Test-Path $releaseFolder) {
  explorer (Resolve-Path $releaseFolder)
} else {
  Write-Warning "Release folder not found: $releaseFolder"
}
