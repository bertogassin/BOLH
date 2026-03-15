param(
  [string]$EnvFile = ".\release-signing.local.env",
  [switch]$SkipPreflight
)

$ErrorActionPreference = "Stop"
$aabFolder = ".\app\build\outputs\bundle\release"
$apkFolder = ".\app\build\outputs\apk\release"

if (-not $SkipPreflight) {
  Write-Host "Step 1/3: Preflight checks" -ForegroundColor Cyan
  .\preflight-release.ps1 -EnvFile $EnvFile
}

Write-Host "Step 2/3: Build release bundle and APK" -ForegroundColor Cyan
.\build-release.ps1 -EnvFile $EnvFile

Write-Host "Step 3/3: Open release folders" -ForegroundColor Cyan
if (Test-Path $aabFolder) {
  explorer (Resolve-Path $aabFolder)
} else {
  Write-Warning "AAB release folder not found: $aabFolder"
}
if (Test-Path $apkFolder) {
  explorer (Resolve-Path $apkFolder)
} else {
  Write-Warning "APK release folder not found: $apkFolder"
}
