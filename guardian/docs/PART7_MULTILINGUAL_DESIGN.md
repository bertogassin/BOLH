# Часть 7: Мультиязычность и профессиональный дизайн

## 7.1 Поддерживаемые языки (50+)

| Ресурс | Описание |
|--------|----------|
| `localization/all_languages.yaml` | Список по регионам: Europe, Asia, Middle East, Caucasus, Africa, Americas; RTL-коды; default: en |
| `GuardianiOS/.../Localization/LanguageManager.swift` | Singleton: currentLanguage, translations, supportedLanguages, detectSystemLanguage(), loadLanguage(), string(key); загрузка с CDN или из бандла (Locales/*.json) |
| `GuardianiOS/.../Localization/RTLSupport.swift` | ViewModifier: layoutDirection по isRTL; .withRTLSupport() |
| `GuardianiOS/.../Localization/LanguageAwareFont.swift` | Шрифты по языку: PingFangSC (zh/ja/ko), NotoNaskhArabic (ar/fa/ur), NotoSansCaucasianAlbanian (ce/av/inh/lez), иначе .system(style) |

## 7.2 Профессиональные иконки

| Ресурс | Описание |
|--------|----------|
| `GuardianiOS/.../Components/ProfessionalIcons.swift` | GuardianIcon (home, orders, bids, shield, guard, weapon, payment, chat, map, document, user, star и др.); ProfessionalIcon(icon:size:color:) |
| `GuardianiOS/.../Core/Theme/IconStyles.swift` | IconGradient (primary, success, warning, error); IconShadow; ProfessionalIconWithBadge |
| `icons/*.svg` | Референсные SVG: weapon, shield, guard, chechen (currentColor для подстановки цвета) |

Иконки в приложении должны быть добавлены в Assets.xcassets (или как SVG в asset catalog) с именами из `GuardianIcon.rawValue`.

## 7.3 Автоопределение языка

| Ресурс | Описание |
|--------|----------|
| `GuardianiOS/.../Localization/LocationLanguageDetector.swift` | По CLLocation → reverseGeocodeLocation → isoCountryCode → countryLanguageMap → LanguageManager.setLanguage |
| `GuardianiOS/.../Localization/SIMLanguageDetector.swift` | По CoreTelephony (CTTelephonyNetworkInfo, isoCountryCode); applySIMLanguageIfSupported() |

## 7.4 Тестирование локализации

| Ресурс | Описание |
|--------|----------|
| `GuardianiOS/GuardianiOSTests/LocalizationTests.swift` | requiredKeys по языкам, RTL, форматирование дат, иконки (raw values), default en |
| `GuardianiOS/GuardianiOSUITests/LocalizationUITests.swift` | Запуск с -AppleLanguages для en/ru/de/fr/es/zh/ja/ar/ce; проверка RTL (кнопка справа для ar) |

Добавьте тестовые таргеты GuardianiOSTests и GuardianiOSUITests в Xcode при необходимости.

## 7.5 Инфраструктура переводов

| Ресурс | Описание |
|--------|----------|
| `infrastructure/translation-system.yaml` | CDN (CloudFront, бакеты translations/icons), список файлов, versioning; Crowdin/Smartling/DeepL; fallback en/ru/zh/ar |
| `services/translations-api/server.js` | Express: GET /:language.json (кэш Redis, fallback на en), POST /webhook для инвалидации кэша |

Переменные окружения: `PORT`, `REDIS_URL`, `TRANSLATIONS_BASE` (S3 или другой URL с *.json).

## Подключение в приложении

- В корневой View приложения применить `.withRTLSupport()` и при необходимости обернуть контент в `LanguageManager.shared` (или EnvironmentObject).
- Для текстов использовать `LanguageManager.shared.string("key")` или обёртку типа `L10n.key`.
- CDN для продакшена: `https://cdn.guardian.app/locales/{code}.json` (настроить в LanguageManager или через конфиг).
