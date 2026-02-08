#!/usr/bin/env bash
set -euo pipefail

echo "Building bolh-core for Android (aarch64 & armv7)..."
if ! command -v cargo-ndk >/dev/null 2>&1; then
  echo "cargo-ndk not found. Install with: cargo install cargo-ndk" >&2
  exit 1
fi

cd "$(dirname "$0")"
cargo ndk -t aarch64-linux-android -o target/android -- cargo build --release
cargo ndk -t armv7-linux-androideabi -o target/android -- cargo build --release

echo "Artifacts: target/android/<target>/release/libbolh_core.so"
