SPARK PoC for BOLH accounting

This directory contains a minimal SPARK/Ada package skeleton for the critical
accounting logic. The goal is to start with small, provable operations
(`Credit`/`Debit`) and extend them with post-quantum-aware key handling and
formal contracts.

To run proofs locally, install the SPARK toolset and use `gnatprove`/`gprbuild`.

Quick start (Linux/macOS):

```sh
cd crates/bolh-spark
./run_proofs.sh
```

Quick start (Windows PowerShell):

```powershell
cd crates\bolh-spark
.\run_proofs.bat
```

Notes:
- If SPARK/GNAT is not installed the scripts will exit with a helpful message.
- The test driver is `src/bolh_accounting_test.adb` which exercises `Credit`/`Debit`.
# BOLH SPARK Template

This folder contains a minimal SPARK/Ada template for critical modules (reward accounting, fork choice). Use GNAT + SPARK tools to develop and prove properties.

Files:
- `src/bolh_accounting.ads` — specification of accounting API
- `src/bolh_accounting.adb` — stub implementation to be replaced with provable code

Build & verify (example):
- Install GNAT + SPARK tools.
- Use `gnat make` and `gnatprove` to build and prove contracts.
