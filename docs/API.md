# Guardio Rapidos API Documentation

## Base URL
```
http://localhost:8000/api/v1
```

## Аутентификация

### POST /auth/login
Вход в систему

**Request:**
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

### POST /auth/register
Регистрация нового пользователя

---

## Охранники (Guards)

### GET /guards
Получить список доступных охранников

**Query Parameters:**
- `lat` (float) - широта
- `lon` (float) - долгота
- `radius_km` (float) - радиус поиска в км
- `specialty` (string) - специализация

### GET /guards/{guard_id}
Получить профиль охранника

### POST /guards/{guard_id}/review
Добавить отзыв

---

## Заказы (Orders)

### POST /orders
Создать заказ на охрану

**Request:**
```json
{
  "order_type": "personal",
  "address": "ул. Примерная, д. 1",
  "latitude": 55.7558,
  "longitude": 37.6173,
  "scheduled_start": "2026-02-01T10:00:00Z",
  "scheduled_end": "2026-02-01T18:00:00Z",
  "description": "Сопровождение на мероприятие"
}
```

### GET /orders
Получить мои заказы

### PUT /orders/{order_id}/status
Обновить статус заказа

---

## Маркетплейс (Marketplace)

### GET /marketplace/products
Получить список товаров

### GET /marketplace/categories
Получить категории

### POST /marketplace/cart/add
Добавить товар в корзину

---

## Обучение (Training)

### GET /training/courses
Получить список курсов

### POST /training/courses/{course_id}/enroll
Записаться на курс

---

## Коды ответов

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 201 | Создано |
| 400 | Неверный запрос |
| 401 | Не авторизован |
| 403 | Доступ запрещён |
| 404 | Не найдено |
| 500 | Ошибка сервера |
