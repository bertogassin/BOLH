#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo '== source hygiene =='
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
fi

echo '== Go API gateway =='
(
  cd guardian/services/api-gateway
  go version
  gofmt -w .
  go vet ./...
  go test -race ./...
  if command -v staticcheck >/dev/null 2>&1; then staticcheck ./...; fi
  if command -v govulncheck >/dev/null 2>&1; then govulncheck ./...; fi
)

echo '== Rust root workspace =='
if command -v cargo >/dev/null 2>&1; then
  cargo fmt --all -- --check
  cargo clippy --all-targets -- -D warnings
  cargo test --all-features
  if command -v cargo-audit >/dev/null 2>&1; then cargo audit; fi
fi

echo '== guardian Rust workspace =='
if command -v cargo >/dev/null 2>&1 && [ -f guardian/Cargo.toml ]; then
  (
    cd guardian
    cargo fmt --all -- --check
    cargo clippy --workspace -- -D warnings
    cargo test --workspace --no-fail-fast
    if command -v cargo-audit >/dev/null 2>&1; then cargo audit; fi
  )
fi

echo '== client web =='
(
  cd guardian/client-web
  npm ci
  npm run lint
  npm run typecheck
  npm run build
  npm audit --audit-level=high
)

echo '== admin web =='
(
  cd guardian/admin
  npm ci
  npm run lint --if-present
  npm run typecheck --if-present
  npm run build
  npm audit --audit-level=high
)

echo 'P0 final checks completed successfully.'
