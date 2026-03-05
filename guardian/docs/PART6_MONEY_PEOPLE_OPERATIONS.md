# Часть 6: Деньги, люди, операции

## 6.1 Юридическая структура (`legal/`)

| Файл | Описание |
|------|----------|
| `jurisdiction.yaml` | Холдинг (Delaware C-Corp), операционные компании (UK, Singapore, UAE, Russia/CIS), IP-холдинг, налоговое планирование |
| `contract_guard_offer.md` | Оферта для охранников (самозанятые): термины, статус сторон, порядок работы, оплата, ответственность, арбитраж |
| `agreement_client.md` | Пользовательское соглашение для клиента: предмет, гарантии, платежи, отмена, персональные данные |
| `insurance.yaml` | Полис: Professional Liability + Cyber, покрытие, исключения, процесс по претензиям |

## 6.2 Финансовая модель (`finance/`)

| Файл | Описание |
|------|----------|
| `unit_economics.py` | LTV клиента/охранника, CAC payback по каналам, когортный LTV |
| `pl_3years.yaml` | P&L на 3 года: выручка, COGS, gross profit, opex, EBITDA, net profit; ключевые метрики |
| `cash_flow.py` | Помесячный прогноз, runway, расчёт оценки (revenue multiple, DCF, comparable) |

## 6.3 Операции (`operations/`)

| Файл | Описание |
|------|----------|
| `verification.py` | Верификация охранников: документы, face match (опционально DeepFace), лицензии, background check; VerificationQueue |
| `support.py` | Тикеты, приоритеты (LOW/MEDIUM/HIGH/URGENT), SLA, автоответы из базы знаний, отчёт по SLA |
| `dispute_resolution.py` | Создание спора, автоанализ (не приехал / качество), разрешение (refund/pay/partial), статистика |

## 6.4 Команда (`team/`)

| Файл | Описание |
|------|----------|
| `org_structure.yaml` | Фазы: seed (10), Series A (50), Series B (product teams + регионы) |
| `raci_matrix.yaml` | RACI по процессам: верификация, споры, релиз фичи, привлечение агентства |
| `compensation.py` | Вилки окладов по уровням, бонус по KPI, опционы, расчёт полной компенсации |

## 6.5 Маркетинговый план (`marketing_plan/`)

| Файл | Описание |
|------|----------|
| `channels.yaml` | Платные каналы (Yandex/Google, Instagram/FB, LinkedIn), органические (SEO, контент, PR), партнёрства, реферальная программа |
| `funnels.py` | Воронка клиента (visit → registration → first_order → payment → repeat), воронка охранника, когортное удержание |
| `creatives.yaml` | Месседжи для клиентов (организаторы, бизнес, частные лица), для охранников, сезонные кампании |
