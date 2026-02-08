# 🚀 Guardio Rapidos - Полное руководство по деплою

## 📋 Содержание
1. [Сборка APK для тестирования](#1-сборка-apk-для-тестирования)
2. [Настройка сервера (Backend)](#2-настройка-сервера-backend)
3. [Подготовка к Play Market](#3-подготовка-к-play-market)
4. [Публикация в Play Market](#4-публикация-в-play-market)
5. [После публикации](#5-после-публикации)

---

## 1. 📦 Сборка APK для тестирования

### Быстрая сборка (Debug APK)

```powershell
cd c:\Users\Amir\Desktop\Guardio\frontend_mobile

# Очистка предыдущих сборок
flutter clean

# Получение зависимостей
flutter pub get

# Сборка debug APK
flutter build apk --debug

# APK будет здесь:
# build\app\outputs\flutter-apk\app-debug.apk
```

### Установка на телефон

**Вариант 1: Через USB**
```powershell
flutter install
```

**Вариант 2: Скопировать APK**
1. Найти файл: `frontend_mobile\build\app\outputs\flutter-apk\app-debug.apk`
2. Скопировать на телефон
3. Открыть и установить (включить "Неизвестные источники")

---

## 2. 🖥️ Настройка сервера (Backend)

### Вариант A: Render.com (Рекомендуется, бесплатно)

1. **Регистрация**: https://render.com

2. **Создать Web Service**:
   - Connect GitHub repository
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

3. **Environment Variables**:
```env
DATABASE_URL=postgresql://user:pass@host:5432/guardio
SECRET_KEY=your-super-secret-key-minimum-32-characters
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
FCM_SERVER_KEY=your-fcm-key
```

4. **База данных**: Render предлагает бесплатный PostgreSQL

### Вариант B: Railway.app

1. **Регистрация**: https://railway.app

2. **New Project** → **Deploy from GitHub**

3. **Add PostgreSQL** из Marketplace

4. **Variables** автоматически подключатся

### Вариант C: DigitalOcean ($5/мес)

```bash
# На сервере Ubuntu
sudo apt update && sudo apt upgrade -y

# Python
sudo apt install python3.11 python3-pip python3-venv -y

# PostgreSQL
sudo apt install postgresql postgresql-contrib -y
sudo -u postgres createuser guardio
sudo -u postgres createdb guardio_db -O guardio

# Клонировать проект
git clone https://github.com/YOUR_USERNAME/guardio-rapidos.git
cd guardio-rapidos/backend

# Виртуальное окружение
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Запуск с gunicorn
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Для постоянной работы используй systemd или supervisor
```

### Настройка HTTPS (SSL)

```bash
# Certbot для бесплатного SSL
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.guardio-rapidos.com
```

---

## 3. 🎯 Подготовка к Play Market

### 3.1 Создание Keystore

```powershell
cd c:\Users\Amir\Desktop\Guardio\frontend_mobile\android

# Создать папку для keystore
mkdir keystore

# Генерация ключа
keytool -genkey -v -keystore keystore\guardio-rapidos.jks -keyalg RSA -keysize 2048 -validity 10000 -alias guardio-rapidos

# Ответить на вопросы:
# - Пароль keystore (ЗАПОМНИТЬ!)
# - Имя и фамилия: Guardio Rapidos
# - Организация: Guardio
# - Город, Страна
```

### 3.2 Настройка key.properties

```powershell
cd c:\Users\Amir\Desktop\Guardio\frontend_mobile\android

# Скопировать шаблон
copy key.properties.template key.properties

# Отредактировать key.properties:
```

```properties
storePassword=ВАШ_ПАРОЛЬ_KEYSTORE
keyPassword=ВАШ_ПАРОЛЬ_КЛЮЧА
keyAlias=guardio-rapidos
storeFile=../keystore/guardio-rapidos.jks
```

### 3.3 Сборка Release APK/AAB

```powershell
cd c:\Users\Amir\Desktop\Guardio\frontend_mobile

# Очистка
flutter clean
flutter pub get

# Release APK (для тестирования)
flutter build apk --release

# App Bundle для Play Market
flutter build appbundle --release

# Файлы:
# APK: build\app\outputs\flutter-apk\app-release.apk
# AAB: build\app\outputs\bundle\release\app-release.aab
```

### 3.4 Обновить BASE_URL

Перед релизом изменить в `lib/core/api_client.dart`:

```dart
// Заменить localhost на ваш сервер
static const String baseUrl = 'https://api.guardio-rapidos.com';
```

---

## 4. 📱 Публикация в Play Market

### 4.1 Регистрация разработчика

1. Перейти: https://play.google.com/console
2. Создать аккаунт разработчика ($25 разово)
3. Заполнить данные

### 4.2 Создание приложения

1. **Create app** → **Android**
2. Заполнить:
   - App name: `Guardio Rapidos`
   - Default language: English (US)
   - App or game: App
   - Free or paid: Free

### 4.3 Store Listing

**App name:**
```
Guardio Rapidos - Security On Demand
```

**Short description (80 символов):**
```
Find professional security guards instantly. Verified, licensed, trusted.
```

**Full description (4000 символов):**
```
🛡️ GUARDIO RAPIDOS - Professional Security at Your Fingertips

Need personal security? Event protection? Property patrol? Guardio Rapidos connects you with verified, licensed security professionals in minutes.

⭐ KEY FEATURES:

FOR CLIENTS:
• Find nearby guards instantly on the map
• View verified profiles, ratings & reviews  
• Book personal protection, events, patrols
• Real-time guard tracking
• In-app chat & voice messages
• Secure payments with escrow protection
• SOS emergency button
• Family safety features

FOR SECURITY PROFESSIONALS:
• Accept jobs in your area
• Build your reputation with reviews
• Flexible schedule & instant payouts
• Team management for events
• Professional certifications display
• Training & courses
• Equipment checklists

🔒 TRUST & SAFETY:
• All guards verified with background checks
• License & insurance verification
• GDPR/CCPA compliant
• Real-time tracking for transparency
• Incident reporting system

🌍 AVAILABLE IN:
English, Русский, Português, Gaeilge, Français, Español

💼 SERVICES:
• Personal bodyguards
• Event security
• Property patrol
• Executive protection
• Remote CCTV monitoring
• Vehicle escort
• Family safety

📱 MARKETPLACE:
Browse and buy security equipment, uniforms, and professional gear.

🎮 REWARDS:
Earn badges, complete quests, climb leaderboards!

Download Guardio Rapidos today - Security. Fast. Trusted.
```

### 4.4 Графика

| Тип | Размер | Описание |
|-----|--------|----------|
| App icon | 512x512 PNG | Логотип приложения |
| Feature graphic | 1024x500 | Баннер для Play Store |
| Screenshots | 320-3840px | Минимум 2, рекомендуется 8 |
| Phone | 16:9 или 9:16 | Скриншоты телефона |
| Tablet 7" | - | Опционально |
| Tablet 10" | - | Опционально |

### 4.5 Content Rating

1. Заполнить questionnaire
2. Категория: `Tools` или `Lifestyle`
3. Возраст: PEGI 3 / Everyone

### 4.6 Privacy Policy

Создать страницу (например на GitHub Pages):
```
https://guardio-rapidos.github.io/privacy-policy
```

### 4.7 Релиз

1. **Production** → **Create new release**
2. Загрузить `.aab` файл
3. Добавить Release notes:
```
v8.0.0 - Initial Release
• Professional security on demand
• Verified guards with background checks
• Real-time tracking
• Secure escrow payments
• Multi-language support
• And much more!
```
4. **Review** → **Start rollout to Production**

---

## 5. 📊 После публикации

### Мониторинг

- **Google Play Console**: Crashes, ANRs, отзывы
- **Firebase Crashlytics**: Детальные crash reports
- **Google Analytics**: Поведение пользователей

### Обновления

```powershell
# Изменить версию в pubspec.yaml
version: 8.1.0+9

# Пересобрать
flutter build appbundle --release

# Загрузить в Play Console → Create new release
```

### Полезные ссылки

- [Flutter Deployment](https://docs.flutter.dev/deployment/android)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [App Signing](https://developer.android.com/studio/publish/app-signing)

---

## 📞 Чек-лист перед релизом

- [ ] Backend задеплоен и работает
- [ ] BASE_URL изменён на production
- [ ] Keystore создан и сохранён в безопасном месте
- [ ] key.properties настроен
- [ ] Release APK протестирован
- [ ] Privacy Policy опубликован
- [ ] App Bundle собран
- [ ] Screenshots готовы
- [ ] Описание написано
- [ ] Google Play Console аккаунт создан ($25)
- [ ] Stripe Live ключи (если нужны платежи)

---

**🎉 Удачного релиза!**

*Guardio Rapidos v8.0.0*
