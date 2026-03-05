# Guardian Android

Kotlin + Jetpack Compose. Тема и экраны по [docs/DESIGN_SYSTEM_UX.md](../docs/DESIGN_SYSTEM_UX.md).

## Структура

- `ui/theme/` — GuardianTheme (светлая/тёмная), ColorScheme, Typography
- `ui/screens/home/` — HomeScreen, HomeViewModel, QuickActionsGrid, ActiveOrdersSection
- `data/models/` — User, Order, Bid, Location, OrderStatus, LicenseType, UserType

## Требования

- Android SDK 24+ (для java.time — 26+ или desugaring)
- Compose Material3, BOM

## Сборка

В корне Android-проекта (полноценный `build.gradle.kts` и `settings.gradle.kts` при необходимости):

```bash
./gradlew assembleDebug
```

## Публикация в Google Play (Internal/Closed)

1. Положите сервисный ключ в `keys/play-service-account.json` (локально, не коммитить).
2. Подготовьте `release-signing.local.env` по примеру `release-signing.local.env.example`.
3. Запустите публикацию:

```powershell
.\publish-play.ps1 -Track internal
```

Для закрытого теста:

```powershell
.\publish-play.ps1 -Track closed
```

Текущие файлы — скелет под копирование в новый проект Android Studio (File → New → Project → Empty Compose Activity), затем скопировать пакеты `ui/theme`, `ui/screens/home`, `data/models`.
