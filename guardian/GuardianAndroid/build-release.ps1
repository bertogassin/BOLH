param(
  [string]$EnvFile = ".\release-signing.local.env"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
  Write-Error "Env file not found: $EnvFile"
}

$pairs = @{}
Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) {
    return
  }
  $splitIndex = $line.IndexOf("=")
  if ($splitIndex -lt 1) {
    return
  }
  $key = $line.Substring(0, $splitIndex).Trim()
  $value = $line.Substring($splitIndex + 1).Trim()
  $pairs[$key] = $value
}

$required = @(
  "RELEASE_STORE_FILE",
  "RELEASE_KEY_ALIAS",
  "RELEASE_STORE_PASSWORD",
  "RELEASE_KEY_PASSWORD"
)

foreach ($name in $required) {
  if (-not $pairs.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($pairs[$name])) {
    Write-Error "Missing value in ${EnvFile}: $name"
  }
}

Write-Host "Starting :app:bundleRelease ..."
.\gradlew.bat :app:bundleRelease `
  "-PRELEASE_STORE_FILE=$($pairs["RELEASE_STORE_FILE"])" `
  "-PRELEASE_KEY_ALIAS=$($pairs["RELEASE_KEY_ALIAS"])" `
  "-PRELEASE_STORE_PASSWORD=$($pairs["RELEASE_STORE_PASSWORD"])" `
  "-PRELEASE_KEY_PASSWORD=$($pairs["RELEASE_KEY_PASSWORD"])"

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Release bundle completed."
Write-Host "Output: app\build\outputs\bundle\release"
