# Индекс реализации функционала Guardian

Спецификация: [FULL_FUNCTIONALITY_SPEC.yaml](./FULL_FUNCTIONALITY_SPEC.yaml) (~785 функций, 12 блоков).

## Привязка блоков к коду

| Блок | Описание | Где реализовано / планируется |
|------|----------|------------------------------|
| **1** | Авторизация и профиль | GuardianiOS, GuardianAndroid, client-web, auth API (добавить), operations/verification.py |
| **2** | Заказы | GuardianiOS (CreateOrderView, OrderDetailView), GuardianAndroid (HomeScreen), client-web (create-order, orders), api-gateway, matching |
| **3** | Задания (Bids) | GuardianiOS (BidsView), GuardianAndroid, client-web, api-gateway |
| **4** | Алгоритм подбора | matching service, ml/demand_forecast, ml/dynamic_pricing, ml/recommendations |
| **5** | Чат | Чат-сервис (добавить), client-web/chats, мобильные приложения |
| **6** | Уведомления | Push-сервис (добавить), GuardianiOS, GuardianAndroid, marketing/ |
| **7** | Платежи | Платежный сервис (добавить), finance/, legal/ |
| **8** | Карты и геолокация | GuardianiOS (OrderMapView), GuardianAndroid, client-web, LocationLanguageDetector |
| **9** | Отзывы и рейтинги | API + мобильные приложения + client-web (добавить экраны) |
| **10** | Админ-панель | **guardian/admin** (дашборд, пользователи, аналитика, настройки) |
| **11** | Технические | Оффлайн (GuardianiOS OfflineIndicator), локализация (localization/), docs, legal/ |
| **12** | Безопасность | compliance/, risk_management.py, auth, HTTPS, Keychain (мобильные) |

## Уже есть в проекте

- **API Gateway (Go)**: регистрация/вход (JWT, bcrypt), GET /auth/me, полный CRUD заказов (create, list, get, update, cancel), CRUD заданий охранника (create, my/bids, get, update), in-memory store (users, orders, bids), админский GET /admin/orders (заголовок X-Admin-Key).
- **Админка**: дашборд, пользователи, карточка пользователя, аналитика, настройки.
- **Клиентская веб-версия**: авторизация (вход/регистрация, контекст, токен в localStorage), главная с заказами из API, создание заказа (форма → POST /api/v1/orders), список заказов и детали заказа (с отменой), профиль (данные пользователя, выход).
- **iOS**: главная, создание заказа, карта, заказы, задания (bids), онбординг, UX (хаптики, скелетоны, оффлайн).
- **Android**: главная, тема, модели, компоненты.
- **Бэкенд/инфра**: api-gateway, matching, Docker, K8s, Terraform, мониторинг, тесты.
- **Юридическое и финансы**: legal/, finance/, operations/ (верификация, саппорт, споры), team/, marketing_plan/.
- **Локализация**: 50+ языков, RTL, client-web можно расширить.

## Дальнейшие шаги по блокам

1. **Блок 1 (Auth)**: отдельный auth-сервис или эндпоинты в api-gateway (регистрация, логин, 2FA, сессии, восстановление пароля).
2. **Блоки 2–3**: доработать API заказов и заданий (CRUD, статусы, фильтры), подключить к client-web и мобильным приложениям.
3. **Блок 4**: донастройка matching (приоритеты, ротация, ML-модели из ml/).
4. **Блок 5**: чат-сервис (WebSocket или long polling), экраны чата в client-web и приложениях.
5. **Блоки 6–7**: push-сервис (FCM/APNs), платежный провайдер (Stripe/ЮKassa и т.п.), экраны в приложениях.
6. **Блоки 8–9**: карты (интеграция с картами в client-web), API отзывов и рейтингов.
7. **Блок 10**: расширение админки (споры, жалобы, верификация, рассылки, настройки, логи).
8. **Блоки 11–12**: оффлайн-логика, обновления, помощь, документы; усиление безопасности (SSL pinning, биометрия, аудит).

Используй [FULL_FUNCTIONALITY_SPEC.yaml](./FULL_FUNCTIONALITY_SPEC.yaml) как чеклист при реализации каждой фичи.
