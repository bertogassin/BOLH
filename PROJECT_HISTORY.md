# История проекта BOLH / Project History BOLH

**Назначение документа:** фиксация хронологии разработки и изменений для подтверждения авторства.  
**Purpose:** Record of development timeline and changes for proof of ownership.

**Автор / Author:** bertogassin  
**GitHub:** https://github.com/bertogassin  
**Репозиторий / Repository:** https://github.com/bertogassin/BOLH  

---

## Русская версия

### Начало проекта

- Создан проект **BOLH** — платформа для заказа услуг и специалистов (клиенты и исполнители).
- Изначально существовали два направления разработки:
  1. **Вариант A (локальная папка BOLH):** бэкенд на Go, мобильное приложение на Android (Kotlin, Jetpack Compose), веб на Vite, AI-сервис на Python, инфраструктура в Docker (PostgreSQL, Redis, API, AI). Документация в `docs/` (PRD, NFR, Roadmap, User Flows), OpenAPI, миграции БД.
  2. **Вариант B (репозиторий на GitHub):** монорепо на Rust/SolidJS/Tauri — общее ядро (Rust), бэкенд (Axum), приложения web, mobile (Tauri), позже desktop; блокчейн-сервис, Elina, mock-api, пакеты `core`, `ui`, `api-client`.

### Основные этапы и обновления

1. **Локальный проект (Go/Android):**
   - Рефакторинг UI в `MainActivity.kt`: карточки (AppCard), иконки, FilterChips, кнопки, секции «Рекомендации», «Заказы рядом», «Специалисты рядом», «Уведомления».
   - Исправления: баланс скобок в `HomeScreen`, замена `JSONObject` для устранения ошибок компиляции.
   - Очистка: удаление приложения с устройства (`adb uninstall`), `gradlew clean`.

2. **Git и репозиторий:**
   - В папке BOLH (Go/Android) выполнена инициализация Git: `git init`, добавлен `.gitignore` (node_modules, .gradle, build, .env и т.д.), первый коммит (110+ файлов), ветка `main`.
   - Репозиторий на GitHub: **bertogassin/BOLH** — использовался для варианта на Rust/SolidJS (исходно с другим названием/брендом).

3. **Клонирование и доработка монорепо:**
   - Клонирован репозиторий с GitHub в отдельную папку (BOLH-guardio-v2).
   - Добавлена недостающая структура по README: приложение **apps/desktop** (Tauri 2 + SolidJS, порт 3002), интеграция в Cargo workspace и корневой `package.json` (скрипты `dev:desktop`, `build:desktop`, `desktop`).
   - Создан файл **STRUCTURE.md** — описание папок и файлов проекта на русском.

4. **Переименование бренда и терминологии (BOLH без слова «guard»):**
   - Все упоминания Guardio/guardio заменены на **BOLH/bolh**: имена пакетов (`@guardio/*` → `@bolh/*`), крейты Rust (`guardio-core` → `bolh-core`, `guardio-backend` → `bolh-backend` и др.), строки и комментарии в коде, README, DEVELOPMENT.md.
   - Роль и сущность «guard» заменены на **specialist**: тип роли пользователя (`UserRole::Guard` → `UserRole::Specialist`), API (`/guards` → `/specialists`, поля `guard_id` → `specialist_id` в ответах), события (`guard:location` → `specialist:location`), тексты в UI («I am a guard» → «I am a specialist», «Book guards» → «Book specialists» и т.д.).
   - Содержимое репозитория сохранено: те же приложения, пакеты, бэкенд, блокчейн, Elina; изменены только названия и тексты под BOLH и specialist.

5. **Документация и доказательство авторства:**
   - Создан настоящий файл **PROJECT_HISTORY.md** с историей проекта с самого начала и сутью всех перечисленных изменений на русском и английском.

### Текущее состояние

- **Репозиторий BOLH (GitHub):** монорепо BOLH (Rust, SolidJS, Tauri: web, mobile, desktop; backend, packages, blockchain, elina). Без бренда Guardio и без слова guard в публичной части.
- **Локальная папка BOLH (Go/Android):** отдельный вариант с Go-бэкендом, Android (Compose), веб, AI, Docker; при необходимости может быть выложен в отдельный репозиторий или объединён по решению автора.

---

## English version

### Project start

- **BOLH** project created — a platform for ordering services and specialists (clients and performers).
- Two development lines from the beginning:
  1. **Variant A (local BOLH folder):** Go backend, Android app (Kotlin, Jetpack Compose), Vite web, Python AI service, Docker stack (PostgreSQL, Redis, API, AI). Docs in `docs/` (PRD, NFR, Roadmap, User Flows), OpenAPI, DB migrations.
  2. **Variant B (GitHub repo):** Rust/SolidJS/Tauri monorepo — shared Rust core, Axum backend, web/mobile (Tauri) apps, later desktop; blockchain service, Elina, mock-api, packages core/ui/api-client.

### Major phases and updates

1. **Local project (Go/Android):**
   - UI refactor in `MainActivity.kt`: AppCard, icons, FilterChips, buttons, sections (Recommendations, Orders nearby, Specialists nearby, Notifications).
   - Fixes: brace balance in `HomeScreen`, `JSONObject` usage for compilation errors.
   - Cleanup: app uninstall from device (`adb uninstall`), `gradlew clean`.

2. **Git and repository:**
   - Git initialized in BOLH (Go/Android) folder: `git init`, `.gitignore` (node_modules, .gradle, build, .env, etc.), first commit (110+ files), `main` branch.
   - GitHub repository **bertogassin/BOLH** used for the Rust/SolidJS variant (originally under a different brand name).

3. **Clone and structure completion:**
   - Repository cloned from GitHub into a separate folder (BOLH-guardio-v2).
   - Missing structure from README added: **apps/desktop** (Tauri 2 + SolidJS, port 3002), integrated into Cargo workspace and root `package.json` (scripts `dev:desktop`, `build:desktop`, `desktop`).
   - **STRUCTURE.md** created — description of project folders and files in Russian.

4. **Rebrand and terminology (BOLH without “guard”):**
   - All Guardio/guardio references replaced with **BOLH/bolh**: package names (`@guardio/*` → `@bolh/*`), Rust crates (`guardio-core` → `bolh-core`, `guardio-backend` → `bolh-backend`, etc.), strings and comments, README, DEVELOPMENT.md.
   - Role and entity “guard” replaced with **specialist**: user role type (`UserRole::Guard` → `UserRole::Specialist`), API (`/guards` → `/specialists`, response fields `guard_id` → `specialist_id`), events (`guard:location` → `specialist:location`), UI copy (“I am a guard” → “I am a specialist”, “Book guards” → “Book specialists”, etc.).
   - Repository content preserved: same apps, packages, backend, blockchain, Elina; only names and copy changed to BOLH and specialist.

5. **Documentation and proof of ownership:**
   - This **PROJECT_HISTORY.md** created with project history from the start and the essence of all changes above, in Russian and English.

### Current state

- **BOLH repository (GitHub):** BOLH monorepo (Rust, SolidJS, Tauri: web, mobile, desktop; backend, packages, blockchain, elina). No Guardio brand or “guard” in public-facing parts.
- **Local BOLH folder (Go/Android):** Separate variant with Go backend, Android (Compose), web, AI, Docker; can be published to another repo or merged at author’s choice.

---

## Краткая хронология изменений / Summary timeline

| Дата (прибл.) / Date (approx.) | Событие / Event |
|---------------------------------|-----------------|
| — | Создание проекта BOLH (оба варианта: Go/Android и Rust/SolidJS). / Project BOLH created (both variants). |
| — | Рефакторинг UI Android, правки компиляции, очистка. / Android UI refactor, build fixes, cleanup. |
| — | Инициализация Git в локальной BOLH, первый коммит. / Git init in local BOLH, first commit. |
| 2026-01-30 | Аккаунт GitHub bertogassin. / GitHub account bertogassin. |
| 2026-02-16 | Релиз BOLH Android APK (Pixel 8) в репозитории. / BOLH Android APK release in repo. |
| — | Клонирование репо, добавление apps/desktop, STRUCTURE.md. / Clone repo, add apps/desktop, STRUCTURE.md. |
| — | Полное переименование Guardio→BOLH, guard→specialist. / Full rebrand Guardio→BOLH, guard→specialist. |
| — | Создание PROJECT_HISTORY.md. / Creation of PROJECT_HISTORY.md. |

---

*Документ создан для сохранения истории разработки и при необходимости подтверждения авторства. Рекомендуется хранить в репозитории и обновлять при значимых изменениях.*

*This document was created to preserve development history and, if needed, proof of ownership. It should be kept in the repository and updated when significant changes are made.*
