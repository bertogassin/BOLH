# Docker Setup Guide для Guardio

## Предварительные требования

1. **Docker Desktop установлен** (скачка и установка завершены)
2. **WSL 2 включён** (если используешь Windows)
3. **Docker Engine запущен** (зелёный статус в Docker Desktop)

## Шаг 1: Убедись что Docker работает

```powershell
docker --version
docker ps
```

Если видишь версию - Docker готов!

## Шаг 2: Запусти PostgreSQL и Redis через Docker

Из корневой директории проекта:

```bash
cd C:\Users\Amir\Desktop\Guardio
docker-compose up -d postgres redis
```

Это запустит:
- PostgreSQL на порте 5432
- Redis на порте 6379

Проверь статус:
```bash
docker-compose ps
```

## Шаг 3: Проверь подключение к базе

```powershell
# Установи psql если его нет (через chocolatey или postgres installer)
psql -h localhost -U guardio -d guardio -c "SELECT 1"
```

Если выведет "1" - база готова!

## Шаг 4: Запусти миграции базы данных

```bash
cd guardio-v2/backend
cargo sqlx migrate run
```

Это создаст все таблицы.

## Шаг 5: Запусти Backend

```bash
cd guardio-v2/backend
cargo run --release
```

Backend запустится на http://localhost:8080

## Шаг 6: Запусти Frontend (в отдельном терминале)

```bash
cd guardio-v2
pnpm run dev:all
```

Это запустит:
- Web: http://localhost:3001
- Mobile: http://localhost:3000
- Mock API удаляется (теперь используем реальный backend)

## Команды Docker

```bash
# Запусти всё (PostgreSQL + Redis + Backend)
docker-compose up -d

# Останови всё
docker-compose down

# Посмотри логи
docker-compose logs -f backend

# Перезагрузи контейнер
docker-compose restart postgres
```

## Если что-то сломалось

### PostgreSQL не подключается
```bash
# Перезагрузи контейнер
docker-compose restart postgres

# Проверь логи
docker-compose logs postgres
```

### Backend не запускается
```bash
# Проверь что PostgreSQL работает
docker-compose ps

# Очисти и пересоздай контейнер
docker-compose down
docker-compose up -d postgres redis
```

### Очистка всего (ВНИМАНИЕ: удалит данные)
```bash
docker-compose down -v
```

## Структура портов

| Сервис | Порт | URL |
|--------|------|-----|
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| Backend (Rust) | 8080 | http://localhost:8080 |
| Frontend Web | 3001 | http://localhost:3001 |
| Frontend Mobile | 3000 | http://localhost:3000 |

## Что произошло?

1. ✅ Откатил все изменения SQLite → PostgreSQL
2. ✅ Создал правильный docker-compose.yml
3. ✅ Создал Dockerfile для Backend
4. ✅ Обновил .env файлы
5. ✅ Backend теперь использует PgPool вместо Pool<AnyDb>

Всё готово к запуску! 🚀
