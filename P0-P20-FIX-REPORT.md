# BOLH P0-P20 Stabilization Repair Report

Prepared from the uploaded `BOLH-main.zip`. The original upload was not modified.

## What was changed

1. **API gateway compile conflict** — removed the obsolete duplicate PostgreSQL feature stub; only one PostgresStore implementation remains.
2. **Client web production 404 path** — retained the existing `pages/_document.tsx` and added an App Router `app/not-found.tsx` fallback.
3. **Plugin RBAC** — split owner/admin/reviewer/read capabilities, restricted publish/team mutation, validated team roles, hardened export CSS input.
4. **Order state transitions** — removed client-controlled arbitrary `status` PATCH; cancellation is a Store-level atomic transition and rejects pending offers.
5. **Bid PATCH invariants** — updates now revalidate price, coordinates and radius before persistence.
6. **Required-license semantics** — matching requires every required license.
7. **Multi-guard matching** — `guard_count` is enforced; order becomes `matched` only when enough offers are accepted.
8. **Transactional matching** — PostgreSQL offer/accept/reject uses transactions and row locks; duplicate guard/bid offers are constrained.
9. **Match accept/reject workflow** — implemented real ownership/state checks and idempotent accept/reject endpoints; client API types/methods updated.
10. **Persistent auth revocation** — token/user revocations and signed nonces are Store-backed; PostgreSQL persists them across restarts. JWT role is refreshed from the current DB user and access-token TTL is reduced to 24 hours.
11. **Persistent escrow ledger** — escrow state moved from process RAM to Store/PostgreSQL and uses integer minor units.
12. **Server-authoritative escrow amount** — request `amount/currency` are no longer trusted; amount is derived from accepted matches or a fixed server-side order budget.
13. **Stripe hardening** — idempotency keys, signature-verified webhook reconciliation, strict production configuration and persistent state transitions.
14. **Verified guard eligibility** — matching requires a verified guard and server-controlled verified-license records; admin can set verified licenses only after identity verification.
15. **Verification workflow** — evidence is persisted privately with SHA-256 metadata; admin list/approve/reject/artifact routes added; approval now truly persists `user.verified`.
16. **Company applications** — registrations are persisted with review status and admin review endpoints.
17. **Document lifecycle** — private permissions, content hashing, tamper-evident signature proof, physical deletion, and production persistent-path enforcement.
18. **Database integrity** — migration `009_p0_integrity_hardening.sql` aligns admin role, FKs, CHECKs, match states, escrow, revocations, verification/company entities and verified licenses.
19. **Adversarial regression tests** — added memory-store tests for capacity/concurrency, replay/revocation, escrow idempotency and verified-license control.
20. **Go-live gates** — npm high-severity audit is blocking; Go CI is moved to supported Go 1.26.8; `rust_decimal` is moved to 1.43 so the obsolete rkyv 0.7 dependency can leave the lockfile after lock regeneration; final-check script included.

## Additional security hardening

- Production refuses to start without `DATABASE_URL`; it cannot silently fall back to in-memory persistence.
- `X-Admin-Key` is disabled in production. It is an explicit non-production escape hatch only when `ALLOW_ADMIN_SECRET=true`.
- Signed mutations bind HMAC-SHA256 to method, canonical path/query, timestamp, nonce, client-integrity value, and SHA-256 request body. Nonces are persistent/atomic in PostgreSQL.
- Production Stripe escrow requires both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- Production document/verification storage requires configured absolute persistent paths.

## Migration

Apply all existing migrations in normal numeric order, including:

`guardian/migrations/009_p0_integrity_hardening.sql`

Before applying 009 to an existing production database, run the orphan preflight queries at the top of the migration and resolve any returned rows. Back up the database first.

## Verification status in this repair environment

Completed locally:

- `gofmt` on all modified Go files
- `git diff --check`
- duplicate receiver/method scan: no duplicate MemoryStore/PostgresStore/handler methods
- Store interface implementation scan: MemoryStore and PostgresStore implement all current Store methods
- Python smoke script syntax (`py_compile`)
- merge-conflict marker scan

Could not be truthfully completed locally because this sandbox has no network access for dependencies/toolchains:

- Go compile/test: local Go is 1.23.2; final module targets Go 1.26 and dependency downloads are blocked
- Rust fmt/test/clippy/audit: Rust toolchain is not installed here
- Next.js lint/typecheck/build/npm audit: uploaded ZIP does not contain `node_modules` and npm downloads are blocked

**Therefore this package is a repaired source tree, not a claim that production CI is already green. Do not deploy until `scripts/p0-final-check.sh` and the repository CI are green.**

## Required production configuration

At minimum configure real secrets and persistent services:

- `APP_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `UPLOAD_DIR` (absolute persistent/shared path)
- `VERIFICATION_UPLOAD_DIR` (absolute persistent/shared path)
- `INTERNAL_SERVICE_TOKEN`
- production CORS/cookie settings appropriate for the deployed domain

Do not set `ALLOW_ADMIN_SECRET=true` in production; production ignores the admin-key escape hatch anyway.

## Deep static-analysis pass (post-P0-P20, sandbox without Go/Rust/network)

Проверено дополнительно (без реальной компиляции — тулчейнов Go/Rust/npm-реестра в среде анализа не было):

- Баланс `{}` по каждому `.go`, `.rs`, `.ts`, `.tsx` файлу — расхождений нет.
- Дублирующиеся `func (receiver) Method` в одном Go-пакете — не найдено.
- Расхождение `package X` внутри одной директории — не найдено.
- Реэкспорты типов в `crates/bolh-domain/src/lib.rs` (`AgencyId`, `BidId`, `ClientId`, `GuardId`, `OrderId` и др.) сверены с фактическими объявлениями (`pub type ... = Uuid`, `pub struct ...`) — все существуют.
- `crates/matching-engine` использует поля `Match`/`Bid` (`id, order_id, bid_id, matched_guard_id, final_price, agency_id, status`, `offer.guard_ids`, `bidder_id`) — совпадают с определениями в `bolh-domain`.
- `unimplemented!()`, `todo!()`, `panic!()` в бизнес-логике (вне тестов/main-инициализации сервера) — не найдено.
- `.unwrap()` встречается только в тестах и в стандартном `axum::serve(...).unwrap()` при старте сервера — не в обработчиках запросов.
- Относительные импорты и алиасы `@/...` в `guardian/client-web` (212 шт.) и `guardian/admin` (8 шт.) — все резолвятся в существующие файлы.
- Директива `go` в `go.mod` всех Go-модулей приведена к `1.26.8` (соответствует `go-version` в `.github/workflows/*.yml`); ранее там были смешаны `1.21`/`1.25.0`/`1.26.0` — это не ломало сборку под тулчейном 1.26.8 (обратная совместимость), но приводится к единообразию.

### Что по-прежнему не проверено компилятором

Эта правка не заменяет реальный CI. В среде анализа нет Go, Rust/cargo и доступа к npm-реестру, поэтому не выполнялись: `go build/test/vet`, `cargo build/test/clippy/audit`, `next build/lint`, `npm audit`. Ручной построчный разбор снижает вероятность ошибок, но не эквивалентен зелёной сборке. Перед деплоем обязательно прогнать `scripts/p0-final-check.sh` / `check-all.sh` на машине с этими тулчейнами.
