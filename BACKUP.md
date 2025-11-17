# CRM 3.0 - Бэкап и восстановление данных

Полное руководство по созданию бэкапов и восстановлению данных CRM 3.0.

> **🆕 НОВОЕ:** Теперь можно автоматически загружать бэкапы на Google Drive!
> Смотрите [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md) для подробных инструкций.

## 📋 Что включено в бэкап

1. **PostgreSQL база данных** - все данные системы (сделки, клиенты, документы и т.д.)
2. **Загруженные файлы** - документы, загруженные в систему (если есть)
3. **Конфигурационные файлы** - .env файлы для восстановления настроек
4. **Метаинформация** - версия, коммит git, дата создания

## 🔧 Требования

### Linux / macOS
```bash
# Убедитесь что установлены:
- Docker и Docker Compose
- tar и gzip (обычно установлены по умолчанию)
- pg_dump (входит в postgres утилиты в контейнере)
```

### Windows (PowerShell)
```powershell
# Убедитесь что установлены:
- Docker Desktop for Windows
- 7-Zip или встроенная поддержка tar в Windows 10+
```

## 🤖 Автоматический бэкап (каждые 3 часа)

Скрипт `python scripts/automated_backup.py` собирает:

- SQL-дамп (`backups/hourly/db_dump_<timestamp>.sql`) и Excel-файл (`.xlsx`), где каждый лист соответствует отдельной таблице из `public`-схемы. Excel генерируется через `psycopg` + `openpyxl`, поэтому требуется установить зависимости (`pip install -r backend/requirements.txt`).
- Инкрементный снимок пользовательских файлов из `backend/media` в `backups/project_files/`: копируются только новые файлы, существующие остаются нетронутыми.
- Автоматическое распределение по временным уровням: `hourly` (последние 3 часа), `daily` (прошедшие сутки), `weekly` (неделя). Старые файлы удаляются после периода хранения, ежедневная и недельная папки получают свежие копии только если предыдущая старше нужного интервала.
- Если `pg_dump` доступен локально — используется он, иначе запускается `docker compose exec -T db pg_dump ...` (в крайнем случае `docker-compose exec`).

Запускать из корня репозитория:

```bash
cd /path/to/CRM\ 3.0
python scripts/automated_backup.py
```

**Расписание:** добавьте запуск каждые 3 часа, например:

#### Linux / macOS (cron)
```
0 */3 * * * cd /path/to/CRM\ 3.0 && python scripts/automated_backup.py >> backups/automated.log 2>&1
```

#### Windows (Task Scheduler)
1. Создайте задачу вызывающую:
   ```
   powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "cd 'C:\Dev\CRM 3.0'; python scripts/automated_backup.py >> .\backups\automated.log 2>&1"
   ```
2. Настройте триггер с интервалом 3 часа.

Скрипт сам следит за retention и показывает куда попали файлы после выполнения.

---

## 📦 Создание бэкапа

### Способ 1: Linux / macOS (рекомендуется)

```bash
# Перейти в папку проекта
cd /path/to/CRM\ 3.0

# Сделать скрипт исполняемым (один раз)
chmod +x backup.sh

# Запустить бэкап
./backup.sh
```

**Результат:**
- Создаст папку `backups/`
- Сохранит файл: `backups/crm3_backup_20250111_153045.tar.gz`
- Выведет информацию о размере

### Способ 2: Windows (PowerShell)

**Быстрый способ - использование встроенных инструментов:**

```powershell
# 1. Создать папку для бэкапа
New-Item -ItemType Directory -Path ".\backups" -Force | Out-Null

# 2. Создать dump БД
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker-compose exec -T db pg_dump -U crm3 crm3 | Out-File -Encoding UTF8 ".\backups\database_$timestamp.sql"

# 3. Скопировать загруженные файлы (если есть)
if (Test-Path ".\backend\media") {
    Copy-Item -Path ".\backend\media" -Destination ".\backups\media_$timestamp" -Recurse
}

# 4. Скопировать конфиги
if (Test-Path ".\backend\.env") {
    Copy-Item -Path ".\backend\.env" -Destination ".\backups\.env.backend_$timestamp"
}

Write-Host "✅ Бэкап завершён. Файлы в папке: .\backups\"
```

**Создать файл скрипта `backup.ps1`:**

```powershell
# backup.ps1 - сохраните в корне проекта и запускайте: powershell -ExecutionPolicy Bypass -File backup.ps1

$BackupDir = ".\backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupName = "crm3_backup_$Timestamp"

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
New-Item -ItemType Directory -Path "$BackupDir\$BackupName" -Force | Out-Null

Write-Host "🔄 Начинаем бэкап CRM 3.0..."

# 1. БД
Write-Host "📦 Создаём dump базы данных..."
docker-compose exec -T db pg_dump -U crm3 crm3 | Out-File -Encoding UTF8 "$BackupDir\$BackupName\database.sql"

# 2. Файлы
if (Test-Path ".\backend\media") {
    Write-Host "📄 Копируем загруженные файлы..."
    Copy-Item -Path ".\backend\media\*" -Destination "$BackupDir\$BackupName\media" -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Конфиги
Write-Host "⚙️  Копируем конфигурацию..."
if (Test-Path ".\backend\.env") { Copy-Item -Path ".\backend\.env" -Destination "$BackupDir\$BackupName\.env.backend" }
if (Test-Path ".\frontend\.env") { Copy-Item -Path ".\frontend\.env" -Destination "$BackupDir\$BackupName\.env.frontend" }

# 4. Информация
$GitInfo = git log -1 --oneline
$GitBranch = git rev-parse --abbrev-ref HEAD
@"
CRM 3.0 Backup Information
==========================
Дата создания: $(Get-Date)
Git commit: $GitInfo
Git branch: $GitBranch

Восстановление: powershell -ExecutionPolicy Bypass -File restore.ps1 $BackupName
"@ | Out-File "$BackupDir\$BackupName\backup_info.txt"

# 5. Архив (если есть 7-Zip)
Write-Host "✅ Бэкап создан в: $BackupDir\$BackupName\"
Write-Host ""
Write-Host "Далее можно архивировать через 7-Zip или Winrar"
```

### Способ 3: Ручной бэкап (любая ОС)

Если скрипты не работают, сделать вручную:

```bash
# 1. Создать папку
mkdir -p backups/crm3_backup_$(date +%Y%m%d_%H%M%S)

# 2. Бэкап БД
docker-compose exec -T db pg_dump -U crm3 crm3 > backups/crm3_backup_*/database.sql

# 3. Копировать файлы
cp -r backend/media backups/crm3_backup_*/

# 4. Архивировать
tar -czf backups/backup_$(date +%Y%m%d_%H%M%S).tar.gz -C backups crm3_backup_*
```

---

## 🔄 Восстановление из бэкапа

### Способ 1: Linux / macOS

```bash
cd /path/to/CRM\ 3.0

# Убедиться что контейнеры запущены
docker-compose up -d

# Восстановить из бэкапа
chmod +x restore.sh
./restore.sh crm3_backup_20250111_153045
```

### Способ 2: Windows (PowerShell)

**Создайте файл `restore.ps1`:**

```powershell
param([string]$BackupName)

if ([string]::IsNullOrEmpty($BackupName)) {
    Write-Host "❌ Укажите имя бэкапа"
    Write-Host "Использование: powershell -ExecutionPolicy Bypass -File restore.ps1 crm3_backup_20250111_153045"
    exit 1
}

$BackupPath = ".\backups\$BackupName"
if (!(Test-Path $BackupPath)) {
    Write-Host "❌ Папка бэкапа не найдена: $BackupPath"
    exit 1
}

Write-Host "🔄 Восстанавливаем CRM 3.0..."

# 1. Убедиться что контейнеры запущены
Write-Host "Проверяем Docker контейнеры..."
docker-compose up -d
Start-Sleep -Seconds 5

# 2. Восстановить БД
Write-Host "🗄️  Восстанавливаем базу данных..."
docker-compose exec -T db dropdb -U crm3 crm3 --if-exists 2>$null
docker-compose exec -T db createdb -U crm3 crm3
Get-Content "$BackupPath\database.sql" | docker-compose exec -T db psql -U crm3 crm3

# 3. Восстановить файлы
if (Test-Path "$BackupPath\media") {
    Write-Host "📄 Восстанавливаем загруженные файлы..."
    New-Item -ItemType Directory -Path ".\backend\media" -Force | Out-Null
    Copy-Item -Path "$BackupPath\media\*" -Destination ".\backend\media\" -Recurse -Force -ErrorAction SilentlyContinue
}

# 4. Восстановить конфиги
if (Test-Path "$BackupPath\.env.backend") {
    Write-Host "⚙️  Восстанавливаем конфигурацию..."
    Copy-Item -Path "$BackupPath\.env.backend" -Destination ".\backend\.env" -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✅ Восстановление завершено!"
Write-Host ""
Write-Host "Следующие шаги:"
Write-Host "  1. docker-compose restart backend"
Write-Host "  2. docker-compose logs -f backend"
```

**Запустить восстановление:**

```powershell
powershell -ExecutionPolicy Bypass -File restore.ps1 crm3_backup_20250111_153045
```

### Способ 3: Ручное восстановление

```bash
# 1. Запустить контейнеры
docker-compose up -d

# 2. Восстановить БД
docker-compose exec -T db dropdb -U crm3 crm3 --if-exists
docker-compose exec -T db createdb -U crm3 crm3
docker-compose exec -T db psql -U crm3 crm3 < backups/crm3_backup_*/database.sql

# 3. Восстановить файлы
cp -r backups/crm3_backup_*/media/* backend/media/

# 4. Перезагрузить бэкенд
docker-compose restart backend
```

---

## 📊 Примеры бэкапов

```
backups/
├── crm3_backup_20250111_150000.tar.gz (5.2 MB)
├── crm3_backup_20250111_140000.tar.gz (5.1 MB)
└── crm3_backup_20250110_120000.tar.gz (4.9 MB)
```

## 🔐 Защита бэкапов

**Важно!** Бэкапы содержат конфиденциальные данные. Защищайте их:

```bash
# Шифровать архив (Linux)
gpg --symmetric backups/crm3_backup_*.tar.gz

# Или архивировать с паролем (7-Zip)
7z a -p backups/crm3_backup_encrypted.7z backups/crm3_backup_*

# Или просто ограничить доступ
chmod 600 backups/crm3_backup_*.tar.gz
```

## 📅 Рекомендуемый график

```
- Ежедневные: вечером (перед работой следующего дня)
- Еженедельные: каждую пятницу в конце дня
- Ежемесячные: первый день месяца (долгосрочное хранилище)
- Автоматизировать через cron (Linux) или Task Scheduler (Windows)
```

## 🔍 Проверка целостности

После восстановления проверьте:

```bash
# 1. Проверить количество записей в таблицах
docker-compose exec -T db psql -U crm3 -d crm3 -c "
SELECT
  schemaname,
  tablename,
  (EXTRACT(EPOCH FROM now() - pg_stat_get_live_tuples(relid) * interval '1 second'))::int8 as row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"

# 2. Проверить что фронтенд видит данные
curl http://localhost:8000/api/v1/clients/

# 3. Проверить админку
http://localhost:8000/admin/
```

## 🆘 Troubleshooting

**Проблема:** `dropdb: error: database "crm3" does not exist`
- **Решение:** Нормально, база будет создана заново

**Проблема:** `permission denied` при восстановлении
- **Решение:** `chmod +x restore.sh` или запустить с `sudo`

**Проблема:** `psql: error: could not connect to server`
- **Решение:** `docker-compose up -d && sleep 10` перед восстановлением

**Проблема:** Файлы не восстановились
- **Решение:** Убедиться что папка `backend/media/` существует и доступна для записи

---

## 📝 Примеры автоматизации

### Linux Cron - Ежедневный бэкап в 22:00

```bash
# Добавить в crontab
crontab -e

# Строка:
0 22 * * * cd /path/to/CRM\ 3.0 && ./backup.sh >> ./backups/backup.log 2>&1
```

### Windows Task Scheduler

1. Создать PowerShell скрипт `backup.ps1` (как выше)
2. Открыть Task Scheduler
3. Create Basic Task
4. Trigger: Daily at 22:00
5. Action:
   ```
   powershell.exe
   -ExecutionPolicy Bypass -File "C:\Dev\CRM 3.0\backup.ps1"
   ```

---

## 📚 Дополнительная информация

- **PostgreSQL pg_dump docs**: https://www.postgresql.org/docs/current/app-pgdump.html
- **Docker volumes backup**: https://docs.docker.com/storage/volumes/#backup-restore-or-migrate-a-data-volume
- **Best practices**: https://wiki.postgresql.org/wiki/Backup_and_Restore
