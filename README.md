# BOLH SECURITY

Платформа закрытых тендеров охранных услуг. Соответствует [ABSOLUTE_STANDARD.md](./ABSOLUTE_STANDARD.md) и [docs/BOLH_TECH_ARCHITECTURE.md](./docs/BOLH_TECH_ARCHITECTURE.md).

## Legacy migration status

BOLH currently remains a legacy-source repository while functionality is
decomposed into ecosystem-aligned services (`core-*`, `marketplace-*`,
`notification-routing`, `payment-gateway`) with Rust-first targets.

## Rust-first policy

- Ядро платформы и доменные сервисы развиваются в модели **Rust-first**.
- Go используется для совместимости и текущих API-слоев, с поэтапным усилением Rust-компонентов.

## Структура

- **Rust (ядро):** домен и Matching Engine в `crates/`:
  - `bolh-domain` — сущности (Money, License, Client, Guard, Agency, Order, Bid, Match), инварианты.
  - `matching-engine` — подбор заказов и предложений (заготовка под индексы и Kafka).
- **Go (API):** модульный монолит в `internal/`, `cmd/api` — точка входа.
- **БД:** PostgreSQL-схема и миграции в `migrations/`.
- **Документация:** `docs/` — архитектура, OpenAPI, C4.

```
crates/
  bolh-domain/      # Rust: домен (типы, бизнес-правила)
  matching-engine/  # Rust: движок подбора
internal/
  user/             # Go: User context (domain, application, infrastructure)
cmd/api/            # Go: HTTP API
migrations/         # SQL
docs/
```

## Требования

- Go 1.21+ (и/или Rust, см. стандарт)
- Переменные окружения для секретов (без хардкода)

## Локальная проверка

```bash
# Go
go fmt ./...
go vet ./...
staticcheck ./...
go test ./...

# Rust (если используется)
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cargo audit
```

## CI

См. `.github/workflows/` — линтер, сборка, тесты, аудит безопасности на каждый PR.
