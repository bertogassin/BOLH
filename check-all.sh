#!/usr/bin/env bash
set -euo pipefail

SKIP_NPM_INSTALL=false
INSTALL_CARGO_AUDIT=false
RUN_CARGO_AUDIT=false
SKIP_P0_SMOKE=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-npm-install)
      SKIP_NPM_INSTALL=true
      ;;
    --install-cargo-audit)
      INSTALL_CARGO_AUDIT=true
      ;;
    --run-cargo-audit)
      RUN_CARGO_AUDIT=true
      ;;
    --skip-p0-smoke)
      SKIP_P0_SMOKE=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: ./check-all.sh [--skip-npm-install] [--install-cargo-audit] [--run-cargo-audit] [--skip-p0-smoke] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

step() {
  echo
  echo "==> $1"
}

assert_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

run_checked() {
  local name="$1"
  local directory="$2"
  local command="$3"

  step "$name"
  echo "Dir: $directory"
  echo "Cmd: $command"

  if [[ "$DRY_RUN" == "true" ]]; then
    return
  fi

  (
    cd "$directory"
    eval "$command"
  )
}

run_p0_smoke() {
  step "P0 smoke (api-gateway)"
  echo "Dir: $API_GATEWAY_DIR"
  echo "Cmd: python3 scripts/p0_smoke.py --api-base http://localhost:8080 --admin-key <key>"

  if [[ "$DRY_RUN" == "true" ]]; then
    return
  fi

  assert_command curl
  assert_command python3

  local p0_admin_key="${P0_SMOKE_ADMIN_KEY:-ci-admin-secret}"
  local started_locally=false
  local api_pid=""

  cleanup() {
    if [[ "$started_locally" == "true" && -n "$api_pid" ]]; then
      kill "$api_pid" >/dev/null 2>&1 || true
      wait "$api_pid" 2>/dev/null || true
    fi
  }
  trap cleanup RETURN

  if ! curl -fsS "http://localhost:8080/health" >/dev/null 2>&1; then
    started_locally=true
    (
      cd "$API_GATEWAY_DIR"
      APP_ENV=test JWT_SECRET=ci-jwt-secret ADMIN_SECRET="$p0_admin_key" go run . >/tmp/bolh-api-gateway-p0.log 2>&1 &
      echo $! > /tmp/bolh-api-gateway-p0.pid
    )
    api_pid="$(cat /tmp/bolh-api-gateway-p0.pid)"

    for i in {1..60}; do
      if curl -fsS "http://localhost:8080/health" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  fi

  curl -fsS "http://localhost:8080/health" >/dev/null
  (
    cd "$API_GATEWAY_DIR"
    python3 scripts/p0_smoke.py --api-base http://localhost:8080 --admin-key "$p0_admin_key"
  )
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARDIAN_ROOT="$REPO_ROOT/guardian"
API_GATEWAY_DIR="$GUARDIAN_ROOT/services/api-gateway"
USER_SERVICE_DIR="$GUARDIAN_ROOT/services/user-service"
NOTIFICATION_SERVICE_DIR="$GUARDIAN_ROOT/services/notification-service"
MATCHING_DIR="$GUARDIAN_ROOT/services/matching"
ORDER_SERVICE_DIR="$GUARDIAN_ROOT/services/order-service"
BID_SERVICE_DIR="$GUARDIAN_ROOT/services/bid-service"
CLIENT_WEB_DIR="$GUARDIAN_ROOT/client-web"

if [[ ! -d "$GUARDIAN_ROOT" ]]; then
  echo "Guardian root not found: $GUARDIAN_ROOT" >&2
  exit 1
fi

assert_command go
assert_command cargo
assert_command npm

if ! command -v staticcheck >/dev/null 2>&1; then
  step "Installing staticcheck"
  if [[ "$DRY_RUN" != "true" ]]; then
    go install honnef.co/go/tools/cmd/staticcheck@latest
  fi
fi

if [[ "$DRY_RUN" != "true" ]]; then
  export PATH="$PATH:$(go env GOPATH)/bin"
fi

run_checked "Go fmt (api-gateway)" "$API_GATEWAY_DIR" "go fmt ./..."
run_checked "Go vet (api-gateway)" "$API_GATEWAY_DIR" "go vet ./..."
run_checked "Staticcheck (api-gateway)" "$API_GATEWAY_DIR" "staticcheck ./..."
run_checked "Go test (api-gateway)" "$API_GATEWAY_DIR" "go test ./..."
if [[ "$SKIP_P0_SMOKE" != "true" ]]; then
  run_p0_smoke
fi

run_checked "Go test (user-service)" "$USER_SERVICE_DIR" "go test ./..."
run_checked "Go test (notification-service)" "$NOTIFICATION_SERVICE_DIR" "go test ./..."

run_checked "Cargo fmt (matching)" "$MATCHING_DIR" "cargo +stable fmt --check"
run_checked "Cargo clippy (matching)" "$MATCHING_DIR" "cargo +stable clippy --all-targets --all-features -- -D warnings"
run_checked "Cargo test (matching)" "$MATCHING_DIR" "cargo +stable test --all-features"

run_checked "Cargo clippy (order-service)" "$ORDER_SERVICE_DIR" "cargo +stable clippy --all-targets --all-features -- -D warnings"
run_checked "Cargo test (order-service)" "$ORDER_SERVICE_DIR" "cargo +stable test --all-features"

run_checked "Cargo clippy (bid-service)" "$BID_SERVICE_DIR" "cargo +stable clippy --all-targets --all-features -- -D warnings"
run_checked "Cargo test (bid-service)" "$BID_SERVICE_DIR" "cargo +stable test --all-features"

if [[ "$INSTALL_CARGO_AUDIT" == "true" || "$RUN_CARGO_AUDIT" == "true" ]]; then
  run_checked "Install cargo-audit" "$REPO_ROOT" "cargo install cargo-audit"
fi

if [[ "$RUN_CARGO_AUDIT" == "true" ]]; then
  run_checked "Cargo audit (repo root)" "$REPO_ROOT" "cargo audit"
fi

if [[ "$SKIP_NPM_INSTALL" != "true" ]]; then
  run_checked "NPM ci (client-web)" "$CLIENT_WEB_DIR" "npm ci"
fi

run_checked "NPM lint (client-web)" "$CLIENT_WEB_DIR" "npm run lint"
run_checked "NPM build (client-web)" "$CLIENT_WEB_DIR" "npm run build"

echo
echo "All checks finished successfully."
