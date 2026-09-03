# BOLH Rust-first hardening — phase 1

This release is a safe compatibility step, not a false “100% Rust” label.

## Delivered

- Rust order and bid services are active behind the existing `/api/v1` gateway.
- PostgreSQL migrations run once and also work with an existing database volume.
- Documents, plugins, teams, comments, plans and tasks persist in PostgreSQL.
- Production services fail closed instead of silently using memory or simulated payments.
- Admin sessions use an HttpOnly, Secure/SameSite cookie instead of localStorage.
- Client and admin are upgraded to Next.js 16 and React 19.
- Client and admin production builds and high-severity npm audits pass.
- CI validates Rust, Go, both web applications, dependency audits and Compose configuration.

## Intentionally retained

- The Go gateway remains the compatibility facade for authentication and routes not yet
  ported. Removing it now would break working product flows.
- The standalone Rust matching worker is opt-in under the `experimental` Compose profile
  until its durable Kafka consumer and restart tests are complete. Matching in the stable
  profile continues through the compatibility gateway.
- Stripe, SMS, email and object storage require real provider credentials before production.

## Local preview

```bash
cd guardian
cp .env.example .env
docker compose up --build
```

- Client: http://localhost:3003
- Admin: http://localhost:3000
- API health: http://localhost:8080/health

The UI and non-payment flows can be inspected without provider keys. Payment capture,
SMS delivery and production email remain unavailable until their credentials are set.

## Before production

Replace every development secret, set `APP_ENV=production`, set `ESCROW_STRICT=true`,
configure Stripe webhooks, SMTP/SMS, S3-compatible storage and TLS. Never reuse the
local-preview secrets from `.env.example`.
