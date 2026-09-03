# BOLH Rust-first consolidation

## Target architecture

The maintained production runtime will contain:

- `client-web`: Next.js user interface.
- `admin`: Next.js operator interface.
- `platform-api`: one Rust/Axum API owning authentication, authorization,
  profiles, orders, bids, matching, messages, notifications, documents,
  agencies, payments and audit events.
- PostgreSQL/PostGIS: the only authoritative relational store.
- Redis: distributed rate limits, short-lived revocation state and jobs.
- S3-compatible storage: document bytes; PostgreSQL stores metadata only.

Browser and mobile UI remain native to their platforms. Business decisions,
validation, ownership and money state live in Rust.

## Compatibility contract

The Rust API must preserve `/api/v1` response and error shapes until every web
and mobile caller has migrated. A compatibility test suite must run against the
Go and Rust implementations for each migrated route. The Go route is removed
only after the Rust route passes those tests with PostgreSQL enabled.

## Migration order

1. Foundation: config, errors, tracing, health, PostgreSQL migrations, auth and RBAC.
2. Profiles, agencies, orders and bids.
3. Deterministic matching and transactional match acceptance.
4. Order-scoped chat, notifications and audit log.
5. Document metadata, object storage, scanning state and signed downloads.
6. Stripe PaymentIntent manual capture, webhook idempotency and reconciliation.
7. Admin operations and monitoring.
8. Switch clients, archive Go services and remove Kafka unless a measured need remains.

## Non-negotiable production rules

- Production never falls back to memory or simulated payments.
- Every write is authenticated and authorized server-side.
- Money uses integer minor units, not floating point.
- Payment and webhook mutations have idempotency keys and database transactions.
- Uploaded files never use the application container filesystem.
- Migrations are applied once, in order, before application traffic.
- Secrets are required at startup and never exposed through public environment variables.
- A feature is not marked migrated until persistence and restart tests pass.
