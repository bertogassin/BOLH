# Миграции Guardian

- **002_full_schema_guardian.sql** — полная схема PostgreSQL + PostGIS (users, profiles, licenses, orders, bids, matches, documents).
- **003_simple_api_gateway.sql** — упрощённые таблицы для API Gateway (gateway_users, gateway_orders, gateway_bids). Используется, когда `DATABASE_URL` задан в api-gateway.

## Запуск с PostgreSQL (API Gateway)

1. Создай БД и выполни миграцию:
   ```bash
   psql -U postgres -d guardian -f guardian/migrations/003_simple_api_gateway.sql
   ```
2. Задай переменную и запусти api-gateway:
   ```bash
   export DATABASE_URL="postgres://user:password@localhost:5432/guardian"
   cd guardian/services/api-gateway && go run .
   ```
   Без `DATABASE_URL` api-gateway работает с in-memory хранилищем.
