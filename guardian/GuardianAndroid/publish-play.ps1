param(
  [string]$EnvFile = ".\release-signing.local.env",
  [ValidateSet("internal", "closed", "open", "production")]
  [string]$Track = "internal",
  [ValidateSet("draft", "completed")]
  [string]$ReleaseStatus = "draft",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Read-KeyValueFile([string]$Path) {
  $pairs = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $splitIndex = $line.IndexOf("=")
    if ($splitIndex -lt 1) { return }
    $key = $line.Substring(0, $splitIndex).Trim()
    $value = $line.Substring($splitIndex + 1).Trim()
    $pairs[$key] = $value
  }
  return $pairs
}

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

$serviceAccountPath = ".\keys\play-service-account.json"
if (-not (Test-Path $serviceAccountPath)) {
  throw "Google Play service-account key not found: $serviceAccountPath"
}

$pairs = Read-KeyValueFile -Path $EnvFile
$required = @("RELEASE_STORE_FILE", "RELEASE_KEY_ALIAS", "RELEASE_STORE_PASSWORD", "RELEASE_KEY_PASSWORD")
foreach ($name in $required) {
  if (-not $pairs.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($pairs[$name])) {
    throw "Missing value in ${EnvFile}: $name"
  }
}

if (-not $SkipBuild) {
  Write-Host "Step 1/2: Build release bundle" -ForegroundColor Cyan
  .\gradlew.bat :app:bundleRelease `
    "-PRELEASE_STORE_FILE=$($pairs["RELEASE_STORE_FILE"])" `
    "-PRELEASE_KEY_ALIAS=$($pairs["RELEASE_KEY_ALIAS"])" `
    "-PRELEASE_STORE_PASSWORD=$($pairs["RELEASE_STORE_PASSWORD"])" `
    "-PRELEASE_KEY_PASSWORD=$($pairs["RELEASE_KEY_PASSWORD"])"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Step 2/2: Publish to Google Play track '$Track' (status: $ReleaseStatus)" -ForegroundColor Cyan
.\gradlew.bat :app:publishReleaseBundle `
  "--release-status" "$ReleaseStatus" `
  "-PRELEASE_STORE_FILE=$($pairs["RELEASE_STORE_FILE"])" `
  "-PRELEASE_KEY_ALIAS=$($pairs["RELEASE_KEY_ALIAS"])" `
  "-PRELEASE_STORE_PASSWORD=$($pairs["RELEASE_STORE_PASSWORD"])" `
  "-PRELEASE_KEY_PASSWORD=$($pairs["RELEASE_KEY_PASSWORD"])" `
  "-PPLAY_SERVICE_ACCOUNT_FILE=keys/play-service-account.json" `
  "-PPLAY_TRACK=$Track"

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Release uploaded to track: $Track" -ForegroundColor Green
