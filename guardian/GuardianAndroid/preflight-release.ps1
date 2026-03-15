param(
  [string]$EnvFile = ".\release-signing.local.env",
  [string]$AabPath = ".\app\build\outputs\bundle\release\app-release.aab"
)

$ErrorActionPreference = "Stop"

function Write-Ok([string]$Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

$hasError = $false

Write-Host "Running release preflight checks..." -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
  Write-Fail "JAVA_HOME is not set in this terminal session."
  $hasError = $true
} elseif (-not (Test-Path $env:JAVA_HOME)) {
  Write-Fail "JAVA_HOME path does not exist: $env:JAVA_HOME"
  $hasError = $true
} else {
  Write-Ok "JAVA_HOME found: $env:JAVA_HOME"
}

if (Get-Command java -ErrorAction SilentlyContinue) {
  # java -version writes to stderr on many JDKs; use cmd redirection to keep preflight stable.
  $javaVersion = (cmd /c "java -version 2>&1" | Select-Object -First 1)
  Write-Ok "Java available: $javaVersion"
} else {
  Write-Fail "java command not found in PATH."
  $hasError = $true
}

if (-not (Test-Path $EnvFile)) {
  Write-Fail "Env file not found: $EnvFile"
  $hasError = $true
} else {
  Write-Ok "Env file found: $EnvFile"
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
      Write-Fail "Missing value in ${EnvFile}: $name"
      $hasError = $true
    } else {
      Write-Ok "Env value present: $name"
    }
  }

  if ($pairs.ContainsKey("RELEASE_STORE_FILE") -and -not [string]::IsNullOrWhiteSpace($pairs["RELEASE_STORE_FILE"])) {
    $keystorePath = Join-Path (Get-Location) $pairs["RELEASE_STORE_FILE"]
    if (Test-Path $keystorePath) {
      Write-Ok "Keystore file found: $keystorePath"
    } else {
      Write-Fail "Keystore file missing: $keystorePath"
      $hasError = $true
    }
  }
}

$buildFile = ".\app\build.gradle.kts"
if (Test-Path $buildFile) {
  $content = Get-Content $buildFile
  $versionCodeLine = $content | Where-Object { $_ -match "^\s*versionCode\s*=" } | Select-Object -First 1
  $versionNameLine = $content | Where-Object { $_ -match "^\s*versionName\s*=" } | Select-Object -First 1
  if ($versionCodeLine) { Write-Ok "Found $($versionCodeLine.Trim())" } else { Write-Warn "versionCode not found in app/build.gradle.kts" }
  if ($versionNameLine) { Write-Ok "Found $($versionNameLine.Trim())" } else { Write-Warn "versionName not found in app/build.gradle.kts" }
} else {
  Write-Warn "app/build.gradle.kts not found."
}

$gradlePropsFile = ".\gradle.properties"
if (Test-Path $gradlePropsFile) {
  $props = @{}
  Get-Content $gradlePropsFile | ForEach-Object {
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
    $props[$key] = $value
  }

  $releaseApi = $props["RELEASE_API_BASE_URL"]
  $releaseWeb = $props["RELEASE_WEB_APP_URL"]
  $releaseEndpoints = @(
    @{ Name = "RELEASE_API_BASE_URL"; Value = $releaseApi },
    @{ Name = "RELEASE_WEB_APP_URL"; Value = $releaseWeb }
  )

  foreach ($entry in $releaseEndpoints) {
    $name = $entry.Name
    $value = [string]$entry.Value
    if ([string]::IsNullOrWhiteSpace($value)) {
      Write-Fail "$name is empty in gradle.properties"
      $hasError = $true
      continue
    }
    if (-not $value.StartsWith("https://")) {
      Write-Fail "$name must use https:// for release (found: $value)"
      $hasError = $true
      continue
    }
    if ($value -match "localhost|127\.0\.0\.1|10\.0\.2\.2") {
      Write-Fail "$name points to local host, not production: $value"
      $hasError = $true
      continue
    }
    Write-Ok "$name looks production-safe: $value"
  }
} else {
  Write-Warn "gradle.properties not found, cannot validate release endpoints."
}

if (Test-Path $AabPath) {
  $item = Get-Item $AabPath
  Write-Ok "AAB exists: $AabPath ($($item.Length) bytes)"
} else {
  Write-Warn "AAB not found yet: $AabPath"
  Write-Warn "Run .\build-release.ps1 to generate release bundle."
}

$ApkPath = ".\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $ApkPath) {
  $item = Get-Item $ApkPath
  Write-Ok "APK exists: $ApkPath ($($item.Length) bytes)"
} else {
  Write-Warn "APK not found yet: $ApkPath"
  Write-Warn "Run .\build-release.ps1 to generate release APK."
}

if ($hasError) {
  Write-Host ""
  Write-Fail "Preflight failed. Fix errors above before upload."
  exit 1
}

Write-Host ""
Write-Ok "Preflight passed. You can upload the release."
