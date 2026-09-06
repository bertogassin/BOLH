# BOLH Final Deep-Check Report

Base archive: `BOLH-P0-P20-DEEPCHECK.zip`.

## Result

The P0-P20 stabilization package was retained. This final pass found one additional backend hardening gap and two documentation inconsistencies, which were corrected without modifying the original archive.

## Additional changes in this final pass

1. `guardian/services/api-gateway/handlers/plans.go`
   - Hardened plan task create/update validation.
   - Task titles must be 1..200 characters.
   - Task descriptions are capped at 5000 characters.
   - `due_at` must be valid RFC3339 instead of being silently ignored when malformed.
   - Explicit assignees must refer to an existing user; empty update assignee falls back to the plan owner/current user.
   - Task status rejects values outside `todo`, `in_progress`, `done` instead of silently ignoring them.
   - `sort_order` must be non-negative.
   - File was normalized and parsed successfully with `gofmt`.

2. `guardian/docs/IMPLEMENTATION_STATUS.md`
   - Replaced stale pre-stabilization claims about an in-memory-only Store, client PATCH-able order status, and production `X-Admin-Key` usage.
   - Document now points to the current PostgreSQL, auth revocation, matching, escrow, verification, RBAC and CI model.

3. `guardian/migrations/README.md`
   - Documented the full API-gateway migration chain through `009_p0_integrity_hardening.sql`.
   - Added `ON_ERROR_STOP`, backup/preflight guidance and clarified the role of `002_full_schema_guardian.sql` versus the `gateway_*` schema.

4. `guardian/services/api-gateway/store/store.go`
   - Corrected the `UserType` model comment to include the supported `admin` role.

## Static checks completed in this environment

- Every `.go` file parses successfully with the installed `gofmt` parser.
- Every `.sh` file passes `bash -n`.
- Every `.json` file parses successfully.
- No merge-conflict markers were introduced.
- The Go version declarations and GitHub workflow toolchain pins are consistently `1.26.8`.

## Not verified here

Full Go compilation/tests cannot run because the installed Go launcher tries to download the Go 1.26.8 toolchain and this sandbox has no network access. Rust/cargo are not installed, and npm dependencies are not present/downloadable.

Therefore the release decision remains: **NO-GO until repository CI and `scripts/p0-final-check.sh` are green in a fully provisioned environment.**
