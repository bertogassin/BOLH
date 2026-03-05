# Карта пути пользователя (Customer Journey) и UX

## Три типа пользователей

### КЛИЕНТ (Заказчик)
- **Мотивация:** Безопасность, спокойствие, уверенность
- **Страхи:** Нанять неквалифицированного, переплатить, не получить
- **Успех:** «Я в безопасности и не думаю об этом»
- **Эмоциональная кривая:** Беспокойство → Надежда → Тревога → Облегчение → Спокойствие → Удовлетворение

### ОХРАННИК (Исполнитель)
- **Мотивация:** Заработок, гибкий график, профессиональный рост
- **Страхи:** Не найти работу, задержки оплаты, опасные ситуации
- **Успех:** «Я зарабатываю, работая когда хочу»
- **Эмоциональная кривая:** Надежда → Готовность → Радость → Ответственность → Довольство → Гордость

### АГЕНТСТВО (Юрлицо)
- **Мотивация:** Прибыль, репутация, масштабирование
- **Страхи:** Простои сотрудников, невыполненные контракты
- **Успех:** «Мои люди всегда заняты, бизнес растет»
- **Эмоциональная кривая:** Формальность → Загрузка сотрудников → Прибыль → Порядок

## Пошаговые сценарии

- **Клиент:** `user-flows/client-flow.yaml` — от осознания потребности до оценки (10 шагов).
- **Охранник:** `user-flows/guard-flow.yaml` — от регистрации до отзыва (8 шагов).

В YAML для каждого шага заданы: эмоция, боль, решение, микротекст (microcopy).

## Реализованные UX-элементы

### iOS (GuardianiOS)

| Элемент | Путь |
|--------|------|
| Тактильный отклик | `Core/UX/HapticManager.swift` — buttonTap, success, error, warning, matchFound |
| Звуки + haptic | `Core/UX/SoundManager.swift` |
| Анимированная кнопка | `Components/AnimatedButton.swift` — scale при нажатии + haptic |
| Анимация поиска | `Components/SearchingAnimation.swift` — пульсация, «N охранников рассматривают» |
| Пустые состояния | `Views/EmptyStates/EmptyOrdersView`, `EmptyBidsView`, `EmptyChatView` |
| Онбординг | `Views/Onboarding/OnboardingView.swift` — WelcomeView, RoleSelectionView, Client/Guard onboarding |
| Подсказки | `Views/UX/TipView.swift` — Tip, TipView (свайп для закрытия) |
| Доступность | `Core/Accessibility/AccessibilityLabels.swift` — accessibleOrderCard, LiveRegionView |
| Скелетон | `Views/UX/SkeletonView.swift`, `AdaptiveSkeleton` |
| Офлайн | `Core/UX/OfflineIndicator.swift` — баннер + счётчик отложенных действий |
| Микротексты | `Core/UX/HumanMessages.swift` — enum HumanMessage (title, body, icon) |

### Android (GuardianAndroid)

| Элемент | Путь |
|--------|------|
| Тактильный отклик | `ui/utils/HapticManager.kt` — View.buttonTap(), success(), error(), searching(vibrator), matchFound(vibrator) |
| Кнопка с отскоком | `ui/components/BounceClick.kt` — Modifier.bounceClick(onClick), PrimaryButton (haptic + scale) |

### Подключение в приложении

- **Онбординг:** показывать `OnboardingView` при `!UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")`.
- **Пустые экраны:** при `orders.isEmpty` показывать `EmptyOrdersView(onCreateOrder: ...)`; при `bids.isEmpty` — `EmptyBidsView`.
- **Поиск:** на экране детали заказа в статусе «Подбор» показывать `SearchingAnimation(onMatchFound: ...)`.
- **Сообщения:** использовать `HumanMessage.orderCreated.title` / `.body` для тостов и заголовков.
- **Доступность:** вызывать `.accessibleOrderCard(orderTitle:address:orderDate:)` на карточке заказа.
- **Загрузка:** оборачивать контент в `AdaptiveSkeleton(isLoading: viewModel.isLoading) { ... }`.
