# Часть 5: Интеллект, аналитика, маркетинг, рост

## 5.1 AI/ML

| Модуль | Путь | Описание |
|--------|------|----------|
| Прогноз спроса | `ml/demand_forecast/model.py` | XGBoost/RandomForest: заказы по району и времени, горячие зоны |
| Динамическое ценообразование | `ml/dynamic_pricing/model.py` | Базовая цена × срочность × сложность × дефицит; surge-множитель |
| Антифрод | `ml/fraud_detection/model.py` | Isolation Forest по признакам активности; real-time мониторинг |
| Рекомендации | `ml/recommendations/model.py` | Скоринг охранников для клиента; коллаборативная фильтрация (cosine) |

Зависимости: `ml/requirements.txt` (numpy, pandas, scikit-learn, xgboost, joblib).

## 5.2 Бизнес-аналитика

| Модуль | Путь | Описание |
|--------|------|----------|
| Метрики и KPI | `analytics/business_metrics.py` | BusinessMetrics (DAU/MAU, LTV/CAC, ретеншн, match rate), MetricsCalculator |
| Realtime дашборд | `analytics/realtime_dashboard.py` | RealtimeAnalytics (Redis), WebSocket `/ws/live` при установленном FastAPI |
| Финансовый прогноз | `analytics/financial_forecast.py` | Тренд выручки/заказов (линейная модель; при необходимости — Prophet) |

## 5.3 Маркетинг и рост

| Модуль | Путь | Описание |
|--------|------|----------|
| Ретеншн | `marketing/retention_engine.py` | RetentionEngine (push/email по сегментам), ABTestManager |
| Виральный движок | `marketing/viral_engine.py` | Реферальные ссылки, QR, шаринг; K-factor |

## 5.4 Масштабирование и IPO

| Ресурс | Путь | Описание |
|--------|------|----------|
| Архитектура на 1B | `scale/billion_users_architecture.yaml` | Регионы, шарды, кэш, Kafka, K8s, DR |
| Оптимизации | `scale/optimizations.py` | BillionScaleOptimizer: batch по шардам, расчёт мощности |
| IPO стратегия | `business/ipo_strategy.py` | Фазы, оценка (DCF/comparables), питч для инвесторов |

## 5.5 Комплаенс и риски

| Модуль | Путь | Описание |
|--------|------|----------|
| Комплаенс | `compliance/compliance_system.py` | GDPR/AML проверки, аудит-лог (HMAC), отчёт; DPO (запросы, утечки) |
| Риски | `risk/risk_management.py` | RiskLevel, регистр рисков (operational, security, financial, compliance), индикаторы, планы снижения |
