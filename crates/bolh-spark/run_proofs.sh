#!/usr/bin/env bash
set -euo pipefail

echo "Running SPARK proofs for Bolh_Accounting"

if ! command -v gnatprove >/dev/null 2>&1; then
  echo "gnatprove not found in PATH. Install SPARK/GNAT to run proofs." >&2
  exit 2
fi

gprbuild -P bolh_accounting.gpr
gnatprove -P bolh_accounting.gpr

echo "Proof run complete (check gnatprove output)."
