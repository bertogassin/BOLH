# Guardian / BOLH — Current Implementation Status

This file reflects the post P0–P20 stabilization source tree. It supersedes the older session note that described the API gateway as in-memory-only and allowed client-controlled order status changes.

## API gateway (`guardian/services/api-gateway`)

- PostgreSQL is required in production through `DATABASE_URL`; in-memory Store is for non-production/testing only.
- JWT authentication supports `client`, `guard`, `agency`, and `admin`. Production admin authorization is JWT/role based; the `X-Admin-Key` escape hatch is disabled in production and is available only in non-production when `ALLOW_ADMIN_SECRET=true`.
- Access tokens expire after 24 hours. Token revocation, per-user revocation and signed-request nonces are Store-backed and persisted by PostgreSQL.
- Orders can be created/read/updated by their owning client. `PATCH /api/v1/orders/:id` does not accept arbitrary status transitions; cancellation uses a dedicated state transition.
- Bids are owner-scoped and validated on create and update.
- Matching requires verified guards and all required verified licenses, supports multi-guard orders, and persists offer/accept/reject state.
- Escrow records are persisted; payment amount/currency are server-authoritative, and Stripe idempotency/webhook reconciliation is implemented.
- Verification evidence, company applications, documents, plugins, plans, notifications and messages are persisted through the Store abstraction.
- Plugin team management and publication use explicit RBAC capabilities rather than treating every team member as an owner.

## Web applications

- `guardian/client-web` is the client-facing Next.js application.
- `guardian/admin` is the administrative Next.js application.
- The client App Router includes an explicit `app/not-found.tsx`; the legacy Pages `_document.tsx` remains available for the pages that require it.

## Database migrations

Apply `guardian/migrations/*.sql` in numeric order. Migration `009_p0_integrity_hardening.sql` adds the role/status constraints, foreign keys, matching state, persistent security state, escrow, verification/company storage and verified licenses used by the stabilized API gateway.

Before applying migration 009 to an existing database, run its orphan preflight queries and take a database backup.

## Verification status

Static source validation has been performed, including Go parsing with `gofmt`, JSON parsing, shell syntax checks and targeted security review. Full release readiness still requires the repository CI / `scripts/p0-final-check.sh` with Go 1.26.8, Rust/cargo and npm dependencies available.

See `P0-P20-FIX-REPORT.md` and `guardian/GO_LIVE_CHECKLIST.md` for the detailed remediation and remaining runtime release gates.
