# Трекер задач — MASTER_PLAN 1+2+3+4

Чек-лист по [MASTER_PLAN_1_2_3_4.md](./MASTER_PLAN_1_2_3_4.md). Отмечай выполненное: `[x]`.

---

## 1. ТЕХНИЧЕСКАЯ РЕАЛИЗАЦИЯ

### Фаза 0
- [x] 1.1 Подключить API Gateway к PostgreSQL (миграция 003, store/postgres.go)
- [x] 1.2 Один скрипт «запустить всё» (guardian/scripts/run-local.ps1, run-local.sh)
- [x] 1.3 CI: линт + тесты (guardian-api, guardian-web в .github/workflows/ci.yml)

### Фаза 1
- [x] 1.4 Order-service: реальный HTTP/gRPC, запись в PostgreSQL
- [x] 1.5 Bid-service: приём ставок, запись в БД
- [x] 1.6 Matching Engine: вызов из API Gateway (синхронный подбор)
- [ ] 1.7 User-service: вынести регистрацию/профиль в отдельный сервис
- [ ] 1.8 Notification-service: email при регистрации и при матче
- [ ] 1.9 Client-web: мультиязычность en/ru из guardian/localization
- [ ] 1.10 Guardian Android: экраны логин, заказы, создание заказа
- [ ] 1.11 GuardianiOS: то же (логин, заказы, создание заказа)

### Фаза 2
- [ ] 1.12 Kafka: события OrderCreated, BidCreated, MatchCreated
- [ ] 1.13 Redis: кэш сессий, rate limit в Gateway через Redis
- [ ] 1.14 K8s: деплой api-gateway, order, bid, matching
- [ ] 1.15 Мониторинг: Grafana дашборды, алерты
- [ ] 1.16 Полный цикл по FULL_FUNCTIONALITY_SPEC (приоритетные блоки)

---

## 2. БИЗНЕС И МАРКЕТИНГ

### Фаза 0
- [x] 2.1 Одностраничный pitch (docs/PITCH_ONE_PAGER.md)
- [x] 2.2 Структура бизнес-плана (docs/BUSINESS_PLAN_STRUCTURE.md)
- [ ] 2.3 Выделить 3–5 KPI для еженедельного отслеживания

### Фаза 1
- [ ] 2.4 Детализация маркетинговой стратегии (каналы, бюджет, креативы)
- [ ] 2.5 Investor deck 10–15 слайдов
- [ ] 2.6 Юридический чек-лист (оферты, политика конфиденциальности)

### Фаза 2
- [ ] 2.7 Дорожная карта до IPO (3 года)
- [ ] 2.8 Партнёрства и B2B (агентства, корпорации)

---

## 3. НОВЫЕ СЕРВИСЫ

### Фаза 0
- [x] 3.1 Документ «ядро BOLH» (docs/BOLH_CORE_PLATFORM.md)

### Фаза 1
- [x] 3.2 Спека DRIVE (docs/services/DRIVE_SPEC.md)
- [x] 3.3 Спека HOME (docs/services/HOME_SPEC.md)
- [x] 3.4 Спека WORK (docs/services/WORK_SPEC.md)
- [x] 3.5 Спека HEALTH (docs/services/HEALTH_SPEC.md)

### Фаза 2
- [ ] 3.6 Выбрать первый «второй сервис», спроектировать общие модули, старт разработки

---

## 4. ЗАПУСК

### Фаза 0
- [x] 4.1 Инструкция запуска (client-web + api-gateway; см. scripts/)
- [x] 4.2 Трекер задач (этот файл)
- [ ] 4.3 Решить: первый регион (город/страна); заполнить docs/LAUNCH_REGIONS.md
- [ ] 4.4 Первые 3–5 наймов (CTO/Backend Lead, мобильный, support)
- [ ] 4.5 Бюджет на первый год по кварталам

### Фаза 1
- [ ] 4.6 Закрыть Seed раунд (pitch + deck + юр.)
- [ ] 4.7 Запуск бета Guardian в одном регионе
- [ ] 4.8 Саппорт: процесс, SLA 15 мин, 1–2 агента
- [ ] 4.9 Первые платящие клиенты / пилоты (10–50 заказов/мес)

### Фаза 2
- [ ] 4.10 Расширение регионов и маркетинг
- [ ] 4.11 Решение о втором сервисе (DRIVE/HOME/WORK/HEALTH), старт спецификации
- [ ] 4.12 Масштабирование команды (phase_2_series_a)
