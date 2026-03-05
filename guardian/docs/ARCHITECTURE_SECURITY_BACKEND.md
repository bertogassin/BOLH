# Архитектура, безопасность, бэкенд — Guardian

## Главный принцип №1

**НИКТО НЕ ВИДИТ ЦЕНЫ ДРУГ ДРУГА. ТОЛЬКО АЛГОРИТМ.**

- Клиент → только свой заказ и статус  
- Охранник → только свои задания и назначения  
- Фирма → только свои охранники и назначения  
- Алгоритм → видит всё и принимает решение  

## Технологический стек

| Слой | Технологии |
|------|------------|
| **Ядро (Rust)** | Matching Engine, Domain, валидация на типах, zero-cost, borrow checker |
| **Сервисы (Go)** | API Gateway, User, Order, Bid, Notification, Document, Payment |
| **Мобильные** | iOS Swift+SwiftUI (Metal), Android Kotlin+Jetpack Compose (Vulkan) |
| **Веб** | Next.js + TypeScript + TailwindCSS (админки) |
| **Инфра** | Nginx, Docker+K8s, PostgreSQL (Citus), Redis, Kafka, MinIO, Prometheus/Grafana/Loki/Jaeger, GitHub Actions |

## Безопасность

- **Аутентификация:** Argon2id для паролей, JWT (короткий TTL), refresh, биометрия (челлендж с сервера).
- **Шифрование цен:** AES-256-GCM (ключи в HSM/Vault); только алгоритм расшифровывает.
- **API:** Rate limiting, CORS whitelist, Security headers (HSTS, CSP, X-Frame-Options и т.д.).
- **Данные:** TLS 1.3, mTLS между сервисами, LUKS на дисках, MinIO SSE, ротация ключей в Vault.
- **OWASP Top 10:** Access control по JWT, параметризованные запросы, DDD, threat modeling, cargo audit/govulncheck в CI, MFA, подпись артефактов, централизованный логинг, SSRF-защита.

## Алгоритм подбора

1. Геопоиск (обязательно).  
2. Фильтр по лицензиям.  
3. Фильтр по бюджету.  
4. Фильтр по доступности (время).  
5. Скоринг: репутация, цена, опыт, расстояние, response_rate, completion_rate.  
6. Приоритет: свободные агенты выше агентств, затем по score.  

Настраиваемые веса: reputation, price, experience, distance, response_rate, completion_rate; плюс priority_free_agents, price_importance, max_search_radius, max_candidates, match_timeout, bid_validity_max.

## Микросервисы

- **API Gateway (Go):** единая точка входа, JWT, rate limit, CORS, security headers, tracing, graceful shutdown.  
- **User Service (Go):** Register (Argon2, Kafka user.created), GetProfile (кэш Redis).  
- **Order Service (Rust):** create_order → БД → Kafka order.created.  
- **Bid Service (Rust):** create_bid → БД → Kafka bid.created.  
- **Notification Service (Go):** Kafka consumer (match.created, match.accepted, …), FCM push, email (gomail).  

Полная модель данных (users, profiles, licenses, orders, bids, matches, documents) и ключи Redis — см. миграции и код.
