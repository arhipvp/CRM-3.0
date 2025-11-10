# 🚀 Быстрый старт CRM 3.0

Запустить проект всего в 3 команды!

## ✅ Требования

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (идёт со всем необходимым)

## 🎯 Запуск (3 команды)

```bash
# 1️⃣  Перейди в папку проекта
cd "C:\Dev\CRM 3.0"

# 2️⃣  Запусти всё
docker-compose up -d

# 3️⃣  Жди ~30 сек инициализации и готово!
```

## 🌐 Доступ

| Что | Адрес | Логин | Пароль |
|-----|-------|-------|--------|
| **Backend API** | http://localhost:8000 | - | - |
| **Admin Panel** | http://localhost:8000/admin | admin | admin123 |
| **API Docs** | http://localhost:8000/api/schema/ | - | - |
| **БД** | localhost:5432 | crm3 | crm3 |

## 📊 Проверка статуса

```bash
# Посмотреть статус контейнеров
docker-compose ps

# Логи приложения
docker-compose logs -f backend

# Логи базы данных
docker-compose logs -f db
```

## 🛑 Остановка

```bash
# Остановить (данные сохранятся)
docker-compose stop

# Удалить всё (ПОТЕРЯ ДАННЫХ!)
docker-compose down -v
```

## 🔧 Полезные команды

```bash
# Войти в Django shell
docker-compose exec backend python manage.py shell

# Запустить миграции заново
docker-compose exec backend python manage.py migrate

# Создать нового суперпользователя
docker-compose exec backend python manage.py createsuperuser

# Подключиться к PostgreSQL
docker-compose exec db psql -U crm3 -d crm3

# Посмотреть логи в реальном времени
docker-compose logs -f backend

# Перестроить image
docker-compose build --no-cache backend
```

## 📚 Полная документация

Для подробного руководства смотри [DOCKER_SETUP.md](./DOCKER_SETUP.md)

## 🐛 Если что-то не работает

```bash
# 1. Проверь что Docker запущен
docker --version

# 2. Посмотри логи
docker-compose logs backend

# 3. Перестартуй контейнеры
docker-compose restart

# 4. Или пересоберись полностью
docker-compose build --no-cache
docker-compose up -d
```

## 🎓 Что запустилось?

```
✅ PostgreSQL Database    (localhost:5432)
✅ Django Backend API     (localhost:8000)
✅ Gunicorn App Server    (автоматически)
✅ Migrations             (автоматически)
✅ Superuser admin        (admin / admin123)
```

## 📝 Структура проекта

```
.
├── backend/                    # Django приложение
│   ├── config/                 # Django конфиг
│   ├── apps/                   # Приложения
│   ├── manage.py
│   ├── Dockerfile
│   ├── entrypoint.sh           # Startup скрипт
│   ├── requirements.txt        # Python зависимости
│   ├── .env                    # Переменные окружения
│   └── .env.example
├── docker-compose.yml          # Оркестрация контейнеров
├── .dockerignore               # Что не копировать
├── DOCKER_SETUP.md             # Полная документация
└── QUICKSTART.md               # Этот файл
```

## 🆘 Первая помощь

**Ошибка: "Address already in use"**
```bash
# Измени порт в docker-compose.yml
# Или узнай какой процесс занимает порт
lsof -i :8000
```

**Ошибка: "Connection refused" к БД**
```bash
# Просто подожди 30-60 сек, БД ещё инициализируется
docker-compose logs db
```

**Ошибка: миграции не применились**
```bash
docker-compose exec backend python manage.py migrate
```

**Не видна статика и медиа**
```bash
docker-compose exec backend python manage.py collectstatic --noinput
```

## 💡 Советы

- 📝 Редактируй код в IDE - контейнер автоматически перезагрузится (volume mounting)
- 🔐 Измени пароль в `backend/.env` перед production
- 📊 Используй `docker-compose logs -f` для отладки
- 🔄 Для изменений в requirements.txt пересоберись: `docker-compose build --no-cache`

---

**Готово! Приложение работает! 🎉**

При первом запуске:
1. Дождись логов "Starting Gunicorn..."
2. Открой http://localhost:8000
3. Перейди на http://localhost:8000/admin
4. Логин: `admin` / Пароль: `admin123`

Дальше смотри [DOCKER_SETUP.md](./DOCKER_SETUP.md) для подробностей.
