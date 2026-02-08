#!/usr/bin/env bash
set -euo pipefail

echo "Building bolh-core for iOS (universal lib)"
if ! command -v cargo-lipo >/dev/null 2>&1; then
  echo "cargo-lipo not found. Install with: cargo install cargo-lipo" >&2
  exit 1
fi

cd "$(dirname "$0")"
cargo lipo --release

echo "Artifacts: target/universal/release/libbolh_core.a"
