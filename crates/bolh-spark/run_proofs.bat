@echo off
echo Running SPARK proofs for Bolh_Accounting
where gnatprove >nul 2>&1 || (
  echo gnatprove not found in PATH. Install SPARK/GNAT to run proofs.
  exit /b 2
)

gprbuild -P bolh_accounting.gpr
gnatprove -P bolh_accounting.gpr

echo Proof run complete (check gnatprove output).