# Guardio Rapidos MVP

**Охрана по запросу** — платформа заказа охранников по требованию.

---

## 🚀 Быстрый старт

### 1. Запуск PostgreSQL

```bash
cd c:\Users\Amir\Desktop\Guardio
docker-compose up -d postgres
```

### 2. Запуск Backend (FastAPI)

```bash
cd c:\Users\Amir\Desktop\Guardio\backend

# Создать виртуальное окружение
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Установить зависимости
pip install -r requirements.txt

# Создать тестовые данные
python -m app.seed

# Запустить сервер
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Swagger UI:** http://localhost:8000/docs

### 3. Запуск Flutter

```bash
cd c:\Users\Amir\Desktop\Guardio\frontend_mobile

# Установить зависимости
flutter pub get

# Запустить на эмуляторе
flutter run
```

---

## 🔑 Тестовые аккаунты

| Роль | Телефон | Пароль |
|------|---------|--------|
| **Client** | +79991111111 | test123 |
| **Guard** | +79992222222 | test123 |

Данные создаются командой: `python -m app.seed`

---

## ⚙️ Конфигурация

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://guardio:guardio_secret@localhost:5432/guardio_db
SECRET_KEY=your-secret-key-change-in-production
```

### Flutter (BASE_URL)

**Файл:** `lib/core/api_client.dart`, строка 15:

```dart
static const String baseUrl = 'http://10.0.2.2:8000';
```

| Платформа | URL |
|-----------|-----|
| Android эмулятор | `http://10.0.2.2:8000` |
| iOS симулятор | `http://localhost:8000` |
| Реальное устройство | `http://192.168.X.X:8000` |

### Google Maps API Key

**Файл:** `android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data android:name="com.google.android.geo.API_KEY" android:value="YOUR_KEY"/>
```

---

## 📱 API Endpoints

### Аутентификация
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | /auth/register | Регистрация |
| POST | /auth/login | Вход → JWT |

### Пользователи
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | /users/me | Текущий пользователь |
| PATCH | /users/location | Обновить координаты |

### Заказы
| Метод | Endpoint | Роль | Описание |
|-------|----------|------|----------|
| POST | /orders/ | client | Создать заказ |
| GET | /orders/ | all | Список заказов |
| GET | /orders/my | guard | Мои принятые |
| POST | /orders/{id}/accept | guard | Принять |
| POST | /orders/{id}/complete | client | Завершить |

### Чат
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | /orders/{id}/messages | Получить сообщения |
| POST | /orders/{id}/messages | Отправить сообщение |

---

## 🧪 Тестовые сценарии

### Сценарий 1: Полный цикл заказа

1. **Client:** Вход (+79991111111 / test123)
2. **Client:** Создать заказ (адрес + цена)
3. **Guard:** Вход (+79992222222 / test123)
4. **Guard:** Увидеть заказ → Принять
5. **Client + Guard:** Чат → Переписка
6. **Client:** Завершить заказ

### Сценарий 2: Проверка доступа

- Guard не может создать заказ (нет кнопки)
- Client не может принять заказ (нет кнопки)
- Чужой client не может завершить заказ (403)

---

## 📁 Структура проекта

### Backend

```
backend/
├── app/
│   ├── main.py           # FastAPI приложение
│   ├── config.py         # Настройки
│   ├── database.py       # SQLAlchemy
│   ├── seed.py           # Тестовые данные
│   ├── models/           # Модели БД
│   │   ├── user.py
│   │   ├── order.py
│   │   └── message.py
│   ├── schemas/          # Pydantic схемы
│   ├── routes/           # API роуты
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── orders.py
│   │   └── messages.py
│   └── services/         # Бизнес-логика
│       ├── auth.py
│       └── geo.py
├── requirements.txt
└── .env
```

### Flutter

```
frontend_mobile/lib/
├── main.dart
├── core/
│   ├── api_client.dart   # HTTP клиент
│   └── auth_storage.dart # JWT хранилище
├── models/
│   ├── user.dart
│   ├── order.dart
│   └── message.dart
├── screens/
│   ├── login_screen.dart
│   ├── register_screen.dart
│   ├── map_screen.dart
│   ├── create_order_screen.dart
│   └── chat_screen.dart
└── services/
    ├── auth_service.dart
    ├── order_service.dart
    └── message_service.dart
```

---

## 📊 Статусы заказа

| Статус | Описание | Действия |
|--------|----------|----------|
| `new` | Новый | Guard: принять |
| `accepted` | Принят | Чат открыт, Client: завершить |
| `done` | Завершён | Только просмотр |

---

## ✅ Готово к тестированию!

1. Backend запущен: http://localhost:8000/docs
2. Тестовые данные созданы
3. Flutter приложение подключено к API
4. Все сценарии работают
