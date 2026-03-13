# Guardian Platform

Платформа закрытых тендеров охранных услуг. **Главный принцип: никто не видит цены друг друга — только алгоритм.**

Монорепозиторий: Cargo workspaces + Go modules.

## Структура

- **core/domain** (Rust) — модели, инварианты, auth (Argon2id), шифрование цен (AES-256-GCM)
- **services/matching** (Rust) — Matching Engine, индексы, config, события (Kafka stub)
- **services/api-gateway** (Go) — Gin, JWT, rate limit, CORS, security headers, /health
- **services/user-service** (Go) — Register, GetProfile, кэш Redis (gRPC stub)
- **services/order-service** (Rust) — POST /orders, валидация (Axum)
- **services/bid-service** (Rust) — POST /bids (Axum)
- **services/notification-service** (Go) — Kafka consumer stub, FCM/email заглушки
- **GuardianiOS** — iOS (Swift, SwiftUI)
- **infra/** — Terraform, Kubernetes, скрипты
- **docs/** — [ARCHITECTURE_SECURITY_BACKEND.md](docs/ARCHITECTURE_SECURITY_BACKEND.md)
- **Language policy** — [ARCHITECTURE_LANG_POLICY.md](ARCHITECTURE_LANG_POLICY.md)
- **migrations/** — PostgreSQL (002_full_schema_guardian.sql: users, profiles, licenses, orders, bids, matches, documents)
- **release process** — [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- **repo boundaries** — [REPO_BOUNDARIES.md](REPO_BOUNDARIES.md)

## Запуск

### Один скрипт (Docker + client-web)

```bash
# Windows (из корня guardian)
.\scripts\start-dev.ps1

# Linux/macOS
chmod +x scripts/start-dev.sh && ./scripts/start-dev.sh
```

Поднимает Postgres, Redis, API Gateway в Docker, затем запускает client-web на http://localhost:3003. API: http://localhost:8080.

## Runtime transparency

- Web UI shows active build id (`build <id>`) in the bottom-left corner.
- API `GET /health` returns `build_id` and `commit` for live verification.

### Вручную

```bash
# Из корня guardian
cargo build   # domain, matching, order-service, bid-service
cd services/api-gateway && go run .
cd services/user-service && go run .    # :8081
cd services/order-service && cargo run  # :8082
cd services/bid-service && cargo run    # :8083
# client-web
cd client-web && npm install && npm run dev   # :3003
```

## Окружение

- Rust 1.70+, Go 1.21+, Swift 5.9+ (Xcode)
- Redis (REDIS_ADDR), PostgreSQL (DATABASE_URL), JWT_SECRET, PORT
- См. docs/ARCHITECTURE_SECURITY_BACKEND.md (безопасность, OWASP, шифрование, Redis ключи)

### Безопасный rollout подписанных запросов (без случайных блокировок)

- Сервер (`services/api-gateway`):
  - `SIGNED_REQUEST_MODE=observe|partial|full` (по умолчанию `observe`)
  - `STRICT_SIGNED_REQUESTS=true` (жёсткий legacy-override -> эквивалент `full`)
  - `SIGNED_REQUEST_PARTIAL_PATHS=/api/v1/auth/me/password,/api/v1/documents/upload`
  - `SIGNED_REQUEST_COOKIE_COMPAT=true` (по умолчанию true; не блокирует cookie-only auth при strict)
  - `SIGNED_NONCE_CACHE_MAX=10000` (ограничение памяти nonce-кэша)
- Клиент (`client-web`):
  - `NEXT_PUBLIC_SIGNED_REQUESTS_ENABLED=1`
  - `NEXT_PUBLIC_SIGNED_REQUEST_MODE=observe|partial|full`
  - `NEXT_PUBLIC_SIGNED_REQUEST_PARTIAL_PATHS=/api/v1/auth/me/password,/api/v1/documents/upload`
  - `NEXT_PUBLIC_APP_BUILD_ID=<release-id>`

Рекомендованный порядок: `observe` -> `partial` (1-2 критичных POST) -> `full` после метрик по ложным срабатываниям и latency.

### Базовый security baseline (24-72h, observe)

- Оставить:
  - `SIGNED_REQUEST_MODE=observe`
  - `STRICT_SIGNED_REQUESTS=false`
- Отслеживать:
  - долю ответов `401/403/429` на чувствительных маршрутах,
  - p95/p99 latency до/после включения заголовков,
  - инциденты `signed_request_*` в логах api-gateway.
- Критерий перехода в `partial`:
  - нет всплеска ложных `401`,
  - нет заметной деградации p95/p99,
  - аномалии ограничены отдельными подозрительными источниками.
