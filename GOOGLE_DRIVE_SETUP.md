# Google Drive Бэкап для CRM 3.0

Полное руководство по настройке автоматических бэкапов на Google Drive.

## 🚀 Быстрый старт (5 минут)

### Шаг 1: Установить rclone

**Windows (Chocolatey):**
```powershell
choco install rclone
```

**Windows (Scoop):**
```powershell
scoop install rclone
```

**Linux/macOS:**
```bash
brew install rclone
```

**Или скачайте вручную:**
https://rclone.org/downloads/

### Шаг 2: Настроить Google Drive

```bash
rclone config
```

Затем выберите:
- `n` - new remote
- Имя: `gdrive` (важно! именно это имя)
- Тип: `google drive` (выберите номер Google Drive)
- Client ID: **оставьте пустым** (нажмите Enter)
- Client Secret: **оставьте пустым** (нажмите Enter)
- Scope: `drive` (выберите для полного доступа)
- Root folder ID: **оставьте пустым**
- Service account: `n`
- Edit advanced config: `n`
- Confirm: `y`

**Откроется браузер** - авторизуйтесь со своим Google аккаунтом.

Готово! Теперь у вас есть `gdrive` в rclone.

### Шаг 3: Сделать первый бэкап

**Linux/macOS:**
```bash
chmod +x backup-gdrive.sh
./backup-gdrive.sh
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File backup-gdrive.sh
```

---

## 📋 Что происходит при бэкапе

1. **Создаёт dump базы данных** - все данные из PostgreSQL
2. **Архивирует загруженные файлы** - если есть
3. **Сохраняет конфигурацию** - .env файлы
4. **Архивирует всё** в tar.gz (Linux) или zip (Windows)
5. **Загружает на Google Drive** в папку `CRM3_Backups`

**Размер бэкапа:** обычно 5-10 MB (в зависимости от объёма данных)

---

## ⏱️ Автоматизация бэкапов

### Вариант 1: Ежедневные бэкапы (Linux/macOS)

```bash
# Добавить в crontab
crontab -e

# Добавить строку (бэкап каждый день в 22:00):
0 22 * * * cd /path/to/CRM\ 3.0 && ./backup-gdrive.sh >> ./backups/backup.log 2>&1
```

**Примеры других расписаний:**
```bash
# Каждый день в 23:00
0 23 * * * cd /path/to/CRM\ 3.0 && ./backup-gdrive.sh

# Каждые 12 часов
0 */12 * * * cd /path/to/CRM\ 3.0 && ./backup-gdrive.sh

# Каждую субботу в 02:00
0 2 * * 6 cd /path/to/CRM\ 3.0 && ./backup-gdrive.sh
```

### Вариант 2: Ежедневные бэкапы (Windows)

**Способ 1: Task Scheduler**

1. Откройте **Task Scheduler** (Планировщик заданий)
2. Нажмите **Create Basic Task**
3. Имя: `CRM 3.0 Google Drive Backup`
4. Trigger: **Daily** → 22:00
5. Action: **Start a program**
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "C:\Dev\CRM 3.0\backup-gdrive.ps1"`
   - Start in: `C:\Dev\CRM 3.0`
6. Нажмите **OK**

**Способ 2: PowerShell (как администратор)**

```powershell
# Создать задачу
$taskName = "CRM3_GoogleDrive_Backup"
$taskPath = "C:\Dev\CRM 3.0\backup-gdrive.ps1"
$time = New-ScheduledTaskTrigger -Daily -At 10:00PM
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File '$taskPath'"
Register-ScheduledTask -TaskName $taskName -Trigger $time -Action $action -Force

Write-Host "✓ Задача создана: $taskName"
Write-Host "⏱️  Будет выполняться каждый день в 22:00"
```

---

## 🔐 Безопасность

### Переменные окружения (вместо .env в бэкапе)

Если вы не хотите бэкапить .env с секретами, отредактируйте скрипт:

**backup-gdrive.sh (Linux):**
```bash
# Закомментируйте эту строку:
# mkdir -p "$BACKUP_DIR/$BACKUP_NAME/config"
# [ -f "./backend/.env" ] && cp ./backend/.env "$BACKUP_DIR/$BACKUP_NAME/config/.env.backend" || true
```

**backup-gdrive.ps1 (Windows):**
```powershell
# Закомментируйте эти строки:
# if (Test-Path ".\backend\.env") { Copy-Item ... }
```

### Ограничить доступ к бэкапам на Google Drive

1. Откройте Google Drive
2. Перейдите в папку `CRM3_Backups`
3. Нажмите правую кнопку → **Share**
4. Выберите кто имеет доступ (по умолчанию только вы)

---

## 📥 Восстановление из Google Drive

### Способ 1: Скачать и восстановить вручную

```bash
# 1. Скачать файл с Google Drive (через web или через rclone)
rclone copy "gdrive:CRM3_Backups/crm3_backup_20250111_150000.tar.gz" ./backups/

# 2. Распаковать
cd backups
tar -xzf crm3_backup_*.tar.gz

# 3. Восстановить
./restore.sh crm3_backup_20250111_150000
```

### Способ 2: Через rclone напрямую

```bash
# Восстановить БД из Google Drive без скачивания на диск
docker-compose exec -T db pg_dump -U crm3 crm3 < <(rclone cat "gdrive:CRM3_Backups/crm3_backup_20250111_150000/database.sql")
```

---

## 🔍 Управление бэкапами на Google Drive

### Список всех бэкапов

```bash
rclone ls "gdrive:CRM3_Backups/"
```

### Размер всех бэкапов

```bash
rclone size "gdrive:CRM3_Backups/"
```

### Удалить старый бэкап

```bash
rclone delete "gdrive:CRM3_Backups/crm3_backup_20250101_150000.tar.gz"
```

### Удалить все бэкапы старше 30 дней

```bash
rclone delete "gdrive:CRM3_Backups/" --min-age 30d
```

---

## 📊 Мониторинг

### Проверить последний бэкап

```bash
rclone lsf "gdrive:CRM3_Backups/" --sort date --reverse | head -1
```

### Отправить уведомление (Linux)

Добавить в crontab:

```bash
0 22 * * * cd /path/to/CRM\ 3.0 && ./backup-gdrive.sh >> ./backups/backup.log 2>&1 && \
  echo "✓ Бэкап завершён" | mail -s "CRM 3.0 Backup Success" your-email@gmail.com
```

---

## 🐛 Troubleshooting

### Ошибка: "gdrive not found"

```bash
rclone config list
```

Если `gdrive` не в списке - повторите `rclone config`

### Ошибка: "Permission denied"

Убедитесь что дали доступ при авторизации (шаг 2).

Переконфигурируйте:
```bash
rclone config delete gdrive
rclone config  # Создайте заново
```

### Ошибка: "Authentication required"

```bash
rclone authorize drive
```

### Бэкап медленно загружается

- Проверьте интернет соединение
- Уменьшите размер бэкапа (удалите старые файлы из media)
- Используйте `--no-traverse` флаг:
```bash
rclone copy . gdrive:CRM3_Backups/ --no-traverse
```

---

## 💡 Советы

### 1. Хранение старых бэкапов

Google Drive дает 15 GB бесплатно. Один бэкап обычно 5-10 MB, т.е. можно хранить ~1500 бэкапов.

Если место заканчивается - удалите старые:
```bash
rclone delete "gdrive:CRM3_Backups/" --min-age 90d  # Удалить старше 3 месяцев
```

### 2. Разные папки для разных окружений

Если у вас prod и dev:
```bash
# Добавить в скрипт:
if [ $ENV == "prod" ]; then
    GDRIVE_PATH="CRM3_Backups_Production"
else
    GDRIVE_PATH="CRM3_Backups_Development"
fi
```

### 3. Уведомления в Telegram/Slack

Добавить в конец скрипта:
```bash
# Telegram
curl -X POST https://api.telegram.org/bot{YOUR_BOT_TOKEN}/sendMessage \
  -d chat_id={CHAT_ID} \
  -d text="✅ Бэкап завершён: ${BACKUP_NAME}.tar.gz (${FILE_SIZE})"
```

---

## 📝 Примеры конфигурации

### Полная настройка для продакшена

```bash
#!/bin/bash
# production-backup.sh

ENVIRONMENT="production"
GDRIVE_PATH="CRM3_Backups_Production"
EMAIL="your-email@gmail.com"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# ... запустить backup-gdrive.sh ...

# Отправить уведомление в Slack
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-type: application/json' \
  -d "{
    \"text\": \"CRM 3.0 Production Backup\",
    \"attachments\": [{
      \"color\": \"good\",
      \"text\": \"✅ Бэкап завершён: ${BACKUP_NAME}\n📊 Размер: ${FILE_SIZE}\"
    }]
  }"
```

---

## 🔗 Полезные ссылки

- **rclone документация**: https://rclone.org/
- **rclone Google Drive**: https://rclone.org/drive/
- **Google Drive Storage**: https://drive.google.com/settings/storage
- **rclone GUI**: https://rclone.org/gui/ (если не нравится CLI)

