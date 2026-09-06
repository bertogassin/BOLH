# Guardian database migrations

The SQL files in this directory are ordered migrations. Apply them in ascending numeric order to the same PostgreSQL database used by the API gateway.

## API gateway sequence

At minimum for a fresh API-gateway database, apply:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f guardian/migrations/003_simple_api_gateway.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f guardian/migrations/004_payment_cards.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f guardian/migrations/005_notifications.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f guardian/migrations/006_messages.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f guardian/migrations/007_verification.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f guardian/migrations/008_documents_plugins_plans.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f guardian/migrations/009_p0_integrity_hardening.sql
```

`002_full_schema_guardian.sql` is the broader Guardian/PostGIS schema and is not a substitute for the `gateway_*` migration chain used by the simple API gateway.

## Existing production database

Before migration 009:

1. take a database backup;
2. run the orphan/preflight queries documented at the top of `009_p0_integrity_hardening.sql`;
3. resolve any rows that would violate the new foreign keys/check constraints;
4. apply with `psql -v ON_ERROR_STOP=1`;
5. run the API smoke/CI checks before serving traffic.

Production must set `DATABASE_URL`; the gateway intentionally refuses to use the in-memory Store in production.
