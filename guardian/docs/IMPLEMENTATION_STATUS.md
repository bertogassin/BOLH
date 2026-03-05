# Статус реализации функционала

Краткий отчёт о том, что **реально запрограммировано** (не только сохранено в спецификации).

## Сделано в этой сессии

### 1. API Gateway (Go) — `services/api-gateway/`

- **Store** (`store/store.go`): in-memory хранилище пользователей, заказов, заданий (Bid). Потокобезопасно.
- **Auth** (`handlers/auth.go`):
  - Регистрация: email, пароль (bcrypt), имя, фамилия, тип (client/guard). Возврат JWT и профиля.
  - Вход: email + пароль, возврат JWT и профиля.
  - GET `/api/v1/auth/me` — профиль текущего пользователя по JWT.
- **Orders** (`handlers/orders.go`):
  - POST `/api/v1/orders` — создание заказа (title, description, budget_min/max, lat/lon, start_time, end_time, guard_count).
  - GET `/api/v1/orders` — список заказов текущего клиента.
  - GET `/api/v1/orders/:id` — детали заказа.
  - PATCH `/api/v1/orders/:id` — обновление (title, description, budget, status).
  - POST `/api/v1/orders/:id/cancel` — отмена заказа.
- **Bids** (`handlers/bids.go`):
  - POST `/api/v1/bids` — создание задания охранника.
  - GET `/api/v1/my/bids` — мои задания.
  - GET `/api/v1/bids/:id`, PATCH `/api/v1/bids/:id`.
- **Admin**: GET `/api/v1/admin/orders` — все заказы (заголовок `X-Admin-Key`, переменная `ADMIN_SECRET`).
- CORS: добавлены localhost:3000, 3001, 3003. Поддержка заголовка `Authorization: Bearer <token>`.

### 2. Клиентская веб-версия (Next.js) — `client-web/`

- **API-клиент** (`lib/api.ts`): `login`, `register`, `fetchMe`, `fetchOrders`, `fetchOrder`, `createOrder`, `cancelOrder`. Base URL из `NEXT_PUBLIC_API_URL` (по умолчанию http://localhost:8080).
- **Авторизация** (`context/AuthContext.tsx`): контекст с user, token, loading, login, register, logout, refreshUser. Токен в localStorage.
- **Страницы**:
  - `/login` — форма входа, после успеха редирект на главную.
  - `/register` — форма регистрации (имя, фамилия, email, пароль).
  - Главная `/`: при отсутствии входа — кнопки «Войти» и «Регистрация»; при входе — приветствие по имени, список активных заказов из API, кнопка «Выйти», FAB «Новый заказ».
  - `/create-order` — форма создания заказа (название, описание, бюджет мин/макс, координаты, дата/время начала и конца, кол-во охранников). POST в API, редирект на `/orders`.
  - `/orders` — список заказов из API.
  - `/orders/[id]` — детали заказа, кнопка «Отменить заказ».
  - `/profile` — данные пользователя (имя, email, тип), кнопка «Выйти».
- Корневой `layout` обёрнут в `AuthProvider`.

### 3. Документация

- `FULL_FUNCTIONALITY_SPEC.yaml` — перечень блоков и функций (сохранён как эталон).
- `FUNCTIONALITY_IMPLEMENTATION_INDEX.md` — привязка блоков к коду и обновлённое описание «что уже есть».
- `IMPLEMENTATION_STATUS.md` — этот файл.

## Как запустить и проверить

1. **API**:  
   `cd guardian/services/api-gateway && go run .`  
   Порт 8080. Redis опционально (для кэша); без Redis сервер стартует.

2. **Клиентская веб-версия**:  
   `cd guardian/client-web && npm run dev`  
   Открыть http://localhost:3003. Зарегистрироваться, войти, создать заказ, посмотреть список заказов и детали.

3. **Переменные окружения**:
   - API: `JWT_SECRET`, `ADMIN_SECRET`, `PORT`, `REDIS_ADDR`.
   - client-web: `NEXT_PUBLIC_API_URL=http://localhost:8080` (если API на другом хосте).

## Что делать дальше (по спецификации)

- Подключить админку к `GET /api/v1/admin/orders` (X-Admin-Key) для списка заказов.
- Реализовать интеграцию matching-сервиса с API (создание заказа → событие в matching).
- Добавить чат, платежи, push, карты, отзывы — по блокам из `FULL_FUNCTIONALITY_SPEC.yaml`.

Все перечисленные выше пункты — это уже **рабочий код**, а не только хранение требований.
