# CI/CD Pipeline Documentation

## Overview

CRM 3.0 использует GitHub Actions для автоматизации testing, linting, building и deployment.

## Pipeline Structure

### 1. CI Pipeline (`.github/workflows/ci.yml`)

Запускается на каждый `push` и `pull_request` в ветки `master` и `develop`.

**Stages:**

#### Backend Linting & Type Checking
- **Black**: Проверка форматирования кода
- **isort**: Проверка сортировки импортов
- **Flake8**: Лinting с проверкой синтаксических ошибок
- **mypy**: Static type checking

```bash
# Локально перед push:
cd backend
black .
isort .
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
mypy . --ignore-missing-imports
```

#### Backend Unit Tests
- Запускается на PostgreSQL 16
- Миграции БД
- pytest с coverage

```bash
# Локально:
cd backend
pip install pytest pytest-django pytest-cov
pytest -v --cov=. --cov-report=xml
```

#### Frontend Linting & Type Checking
- **ESLint**: JavaScript/TypeScript linting
- **TypeScript**: Type checking без компиляции

```bash
# Локально:
cd frontend
npm run lint
npx tsc --noEmit
```

#### Frontend Build Test
- Собирает Production build
- Проверяет отсутствие ошибок при сборке

```bash
# Локально:
cd frontend
npm run build
```

#### Docker Build
- Собирает Docker images для backend и frontend
- Кэширует слои для скорости

### 2. Deploy Pipeline (`.github/workflows/deploy.yml`)

Запускается **только** при `push` в `master` ветку (или вручную через `workflow_dispatch`).

**Steps:**

1. **Clone code** - Git checkout на VPS
2. **Build Docker images** - Собирает backend и frontend
3. **Stop old containers** - `docker-compose down` (БД сохраняется!)
4. **Start new containers** - `docker-compose up -d`
5. **Run migrations** - `python manage.py migrate`
6. **Collect static** - `python manage.py collectstatic`
7. **Health check** - Проверяет API доступность
8. **Slack notification** - Уведомление о статусе (опционально)

## GitHub Secrets Configuration

Для работы deployment pipeline нужно добавить GitHub Secrets:

### Обязательные:

```
VPS_HOST          = IP адрес VPS (например: 1.2.3.4)
VPS_USER          = SSH юзер (например: deploy)
VPS_SSH_KEY       = Private SSH key для подключения
VPS_PORT          = SSH port (обычно 22)
```

### Опциональные:

```
SLACK_WEBHOOK     = Webhook для Slack уведомлений
DOCKER_REGISTRY   = Docker Hub username (если нужен push)
DOCKER_PASSWORD   = Docker Hub password
```

### Как добавить Secrets:

1. Перейдите в Settings → Secrets and variables → Actions
2. Нажмите "New repository secret"
3. Добавьте каждый secret

## Environment Variables

### Backend (.env)

```env
DEBUG=False
DJANGO_SECRET_KEY=<your-secure-key>
DJANGO_DB_ENGINE=django.db.backends.postgresql
DJANGO_DB_HOST=db
DJANGO_DB_PORT=5432
DJANGO_DB_NAME=crm3
DJANGO_DB_USER=crm3
DJANGO_DB_PASSWORD=<secure-password>
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Frontend (.env)

```env
VITE_API_URL=https://api.yourdomain.com/api/v1
```

## Local Development

### Before Push

**Убедитесь, что локально проходят все проверки:**

```bash
# Backend
cd backend
black .
isort .
flake8 . --count --select=E9,F63,F7,F82
mypy . --ignore-missing-imports
python manage.py test

# Frontend
cd ../frontend
npm run lint
npx tsc --noEmit
npm run build
```

### Git Hooks (Optional)

Можно добавить pre-commit hook для автоматических проверок:

```bash
# .git/hooks/pre-commit
#!/bin/bash
cd backend && black --check . && isort --check . && flake8 . && mypy .
cd ../frontend && npm run lint && npx tsc --noEmit
```

## Deployment Checklist

Перед deployment на продакшен убедитесь:

- [ ] Все tests проходят локально
- [ ] Код запушен в `master` ветку
- [ ] GitHub Actions workflow завершился успешно
- [ ] VPS доступен по SSH
- [ ] SSH key добавлен в GitHub Secrets
- [ ] `.env` файлы заполнены корректно
- [ ] DNS записи указывают на VPS IP

## Troubleshooting

### Deploy fails - "Cannot allocate memory"

**Решение:** Увеличить memory limit в docker-compose.yml или перезагрузить VPS

### Tests fail locally but pass in CI

**Проверьте:**
- Python версия совпадает (3.12)
- Node версия совпадает (20)
- Все dependencies установлены

### SSH connection refused

**Проверьте:**
- VPS_HOST, VPS_USER, VPS_PORT верны
- SSH key добавлен в authorized_keys на VPS
- Firewall не блокирует SSH (обычно 22 порт)

### Docker image build fails

**Проверьте:**
- Dockerfile синтаксис
- Все необходимые файлы в .dockerignore исключены
- Docker daemon running

## Monitoring

После deployment используйте:

```bash
# На VPS
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Health check
curl http://localhost:8000/health/
```

## Best Practices

1. **Никогда** не пушьте secrets в репозиторий
2. **Всегда** используйте `docker-compose down` без флага `-v`
3. **Регулярно** проверяйте логи на ошибки
4. **Резервируйте** БД перед major updates
5. **Тестируйте** миграции локально перед push

## References

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Django Deployment](https://docs.djangoproject.com/en/5.0/howto/deployment/)
