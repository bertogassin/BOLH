#!/bin/sh
set -eu

until pg_isready -q; do
  sleep 1
done

psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS guardian_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

# Older installations applied the first schema through docker-entrypoint-initdb.d
# before migration history existed. Adopt that schema instead of replaying it.
if [ "$(psql -Atqc "SELECT to_regclass('public.users') IS NOT NULL")" = "t" ]; then
  psql -v ON_ERROR_STOP=1 -c "INSERT INTO guardian_schema_migrations(version) VALUES ('002_full_schema_guardian.sql') ON CONFLICT DO NOTHING"
fi

for migration in /migrations/*.sql; do
  version="$(basename "$migration")"
  applied="$(psql -Atqc "SELECT 1 FROM guardian_schema_migrations WHERE version = '$version'")"
  if [ "$applied" = "1" ]; then
    continue
  fi

  echo "Applying $version"
  psql -v ON_ERROR_STOP=1 -v migration_version="$version" <<SQL
BEGIN;
\i $migration
INSERT INTO guardian_schema_migrations(version) VALUES (:'migration_version');
COMMIT;
SQL
done
