# BOLH

Единый репозиторий для самостоятельной работы платформы BOLH (Guardian stack): web, API, мобильные клиенты, инфраструктурные конфиги и CI/CD.

## Основной рабочий стек

- `guardian/client-web` — Next.js frontend.
- `guardian/services/api-gateway` — основной API gateway (Go).
- `guardian/services/*` — сервисы домена (matching, order, bid, user, notifications).
- `guardian/docker-compose.yml` — локальный подъем зависимостей и API.
- `.do/app.yaml` / `.do/app-staging.yaml` — DigitalOcean App Platform конфиги.

`guardian` — главный runtime-контур для запуска и деплоя.

## Быстрый локальный запуск

```powershell
cd guardian
.\scripts\start-dev.ps1
```

Или на Linux/macOS:

```bash
cd guardian
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh
```

После запуска:
- web: `http://localhost:3003`
- api: `http://localhost:8080`

Для запуска из корня репозитория:

- Windows (PowerShell): `./start-project.ps1`
- Linux/macOS (bash): `chmod +x ./start-project.sh && ./start-project.sh`

## Полная проверка проекта

- Windows (PowerShell): `./check-all.ps1`
- Linux/macOS (bash): `chmod +x ./check-all.sh && ./check-all.sh`

## Переменные окружения

- Шаблон: `.env.example` (в корне репозитория).
- Для production обязательно задать секреты: `JWT_SECRET`, `ADMIN_SECRET`.
- Для API persistence обязательно задать: `DATABASE_URL`, `REDIS_ADDR`.

## DigitalOcean деплой

- Production: `.do/app.yaml` (ветка `main`, домены `app.omnixius.com` и `api.omnixius.com`).
- Staging: `.do/app-staging.yaml` (ветка `main`, staging-домены).
- Перед первым деплоем обнови placeholder-секреты в DO (`JWT_SECRET`, `ADMIN_SECRET`) и проверь env.

## CI/CD

Workflows в `.github/workflows/` покрывают:
- Go/Rust проверки,
- сборку и проверку `guardian/client-web`,
- Android release pipeline в Google Play.
