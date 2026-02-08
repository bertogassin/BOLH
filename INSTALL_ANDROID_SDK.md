# 📱 Установка Android SDK для сборки APK

## Вариант 1: Android Studio (Рекомендуется)

### Шаг 1: Скачать Android Studio
1. Перейти: https://developer.android.com/studio
2. Скачать **Android Studio** для Windows
3. Установить (занимает ~2-3 GB)

### Шаг 2: Первый запуск
1. Запустить Android Studio
2. Выбрать "Standard" installation
3. Дождаться загрузки SDK (~5-10 минут)

### Шаг 3: Настроить Flutter
```powershell
# Указать путь к SDK
flutter config --android-sdk "C:\Users\%USERNAME%\AppData\Local\Android\Sdk"

# Принять лицензии
flutter doctor --android-licenses

# Проверить
flutter doctor
```

---

## Вариант 2: Только Command Line Tools (Легче)

### Шаг 1: Скачать
1. Перейти: https://developer.android.com/studio#command-line-tools-only
2. Скачать "Command line tools only" для Windows
3. Распаковать в `C:\Android\cmdline-tools\latest`

### Шаг 2: Установить SDK
```powershell
# Создать папки
mkdir C:\Android\sdk

# Установить SDK
cd C:\Android\cmdline-tools\latest\bin
sdkmanager --sdk_root=C:\Android\sdk "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### Шаг 3: Environment Variables
1. Открыть: Система → Дополнительные параметры → Переменные среды
2. Добавить:
   - `ANDROID_HOME` = `C:\Android\sdk`
   - В `Path` добавить:
     - `C:\Android\sdk\platform-tools`
     - `C:\Android\sdk\cmdline-tools\latest\bin`

### Шаг 4: Настроить Flutter
```powershell
flutter config --android-sdk "C:\Android\sdk"
flutter doctor --android-licenses
flutter doctor
```

---

## После установки

```powershell
# Проверить что всё работает
flutter doctor

# Должно показать:
# [√] Android toolchain - develop for Android devices

# Собрать APK
cd c:\Users\Amir\Desktop\Guardio\frontend_mobile
flutter build apk --debug
```

---

## Быстрая проверка

После установки запустите:
```powershell
flutter doctor -v
```

Должно показать ✓ для Android toolchain.

---

## Нужна помощь?

- Flutter Setup: https://docs.flutter.dev/get-started/install/windows
- Android SDK: https://developer.android.com/studio
