# Как установить Guardian на телефон

## Android

### Вариант 1: Через Android Studio (рекомендуется)

1. Установи [Android Studio](https://developer.android.com/studio).
2. Открой папку `guardian/GuardianAndroid` как проект (**File → Open**).
3. Подключи телефон по USB, включи **Режим разработчика** и **Отладку по USB** в настройках.
4. В Android Studio выбери своё устройство в списке и нажми **Run** (зелёный треугольник) или **Ctrl+R**.
5. Приложение установится и запустится на телефоне.

### Вариант 2: Собрать APK и установить вручную

1. В папке `guardian/GuardianAndroid` открой терминал.
2. Выполни:
   ```bash
   ./gradlew assembleDebug
   ```
3. APK будет здесь: `app/build/outputs/apk/debug/app-debug.apk`.
4. Скопируй `app-debug.apk` на телефон (USB, облако, мессенджер).
5. На телефоне открой файл и разреши установку из неизвестных источников при запросе.
6. Установи приложение.

---

## iPhone (iOS)

Установка на iPhone возможна только через **Mac с Xcode** (или сервисы вроде TestFlight для бета-тестеров).

### Через Xcode на Mac

1. Установи [Xcode](https://developer.apple.com/xcode/) из App Store.
2. Открой проект GuardianiOS в Xcode:
   - Если есть файл `GuardianiOS.xcodeproj` — открой его.
   - Если нет — **File → New → Project → App**, укажи имя GuardianiOS, затем перетащи в проект папки `GuardianiOS` (Models, Views, ViewModels, Components, Core и т.д.).
3. Подключи iPhone по USB, при первом подключении на телефоне нажми **Доверять**.
4. В Xcode выбери свой iPhone в списке устройств (вверху).
5. Нажми **Run** (▶) или **Cmd+R**.
6. На iPhone может потребоваться: **Настройки → Основные → VPN и управление устройством** → доверить разработчику (твой Apple ID).

Без Mac установить тестовую сборку на iPhone нельзя; для распространения нужен App Store или TestFlight.

---

## Кратко

| Платформа | Действие |
|-----------|----------|
| **Android** | Android Studio → Open `GuardianAndroid` → Run на устройстве. Или `./gradlew assembleDebug` → установить `app-debug.apk` на телефон. |
| **iPhone** | Только с Mac: Xcode → открыть GuardianiOS → Run на подключённом iPhone. |

После первой установки приложение будет в списке приложений как **Guardian**.
