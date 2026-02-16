# Структура репозитория BOLH

Краткое описание папок и файлов — куда что класть и за что что отвечает.

## Корень

| Файл / папка       | Назначение |
|--------------------|------------|
| `package.json`     | Монорепо: скрипты `pnpm dev`, `build`, `dev:web`, `dev:mobile`, `dev:desktop`, `android`, `ios`, `desktop`, `api:mock` |
| `pnpm-workspace.yaml` | Подключение `apps/*` и `packages/*` |
| `Cargo.toml`       | Rust workspace: core, backend, mobile/desktop Tauri, blockchain, elina |
| `README.md`        | Описание проекта и быстрый старт |
| `DEVELOPMENT.md`   | Детали разработки, порты, задачи |
| `mock-api/`        | Mock REST API (json-server): `db.json`, `routes.json` |

## Приложения (`apps/`)

| Папка | Описание |
|-------|----------|
| **apps/web** | Веб-приложение (SolidJS + Vite). Порт 3001. Страницы: Home, Map, Orders, Wallet, Profile и др. |
| **apps/mobile** | Мобильное приложение (SolidJS + Tauri 2). Android/iOS. `src/` — фронт, `src-tauri/` — Rust. Порт 3000. |
| **apps/desktop** | Десктопное приложение (SolidJS + Tauri 2). `src/` — фронт, `src-tauri/` — Rust. Порт 3002. |

Во всех app’ах общие UI-компоненты из `packages/ui`.

## Пакеты (`packages/`)

| Папка | Назначение |
|-------|------------|
| **packages/core** | Общее Rust-ядро: crypto, geo, validation, auth, orders, specialists, payments, storage. Используется backend и Tauri (mobile/desktop). |
| **packages/ui** | Общие SolidJS-компоненты (atoms, molecules, organisms). Подключаются в apps/web, apps/mobile, apps/desktop. |
| **packages/api-client** | API-клиент для фронтов (TypeScript). |

## Бэкенд и сервисы

| Папка | Назначение |
|-------|------------|
| **backend/** | Rust/Axum API: auth, users, specialists, orders, payments, chat. WebSocket. PostgreSQL, Redis. `.env.example` — шаблон конфига. |
| **blockchain/** | Блокчейн: `core/` (chain, consensus, rpc, network), `bolh-ffi/` (FFI для приложений). |
| **blockchain-service/** | Сервис поверх blockchain core (Rust). |
| **elina/core** | Модуль Elina (Rust): state, sound, skin, behavior и др. |

## Общее

| Папка | Назначение |
|-------|------------|
| **shared/types** | Общие TypeScript-типы. `index.ts`. |

## Команды (из корня)

```bash
pnpm install          # зависимости
pnpm dev:web          # только веб (3001)
pnpm dev:mobile       # только мобильное (3000)
pnpm dev:desktop      # только десктоп (3002)
pnpm dev:all          # web + mobile + api:mock
pnpm android          # Tauri Android dev
pnpm ios              # Tauri iOS dev
pnpm desktop          # Tauri desktop dev
pnpm api:mock         # Mock API на 8080
cargo build --workspace   # все Rust-пакеты
```

Содержимое репозитория распределено по этим папкам и файлам; при добавлении нового кода используй соответствующую директорию из таблиц выше.
