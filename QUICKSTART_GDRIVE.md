# Быстрый старт: Бэкап на Google Drive

Просто 3 шага чтобы начать автоматические бэкапы на Google Drive!

## 🚀 Шаг 1: Установить rclone (2 минуты)

### Windows
```powershell
# Если установлен Chocolatey:
choco install rclone

# Если установлен Scoop:
scoop install rclone

# Или скачайте: https://rclone.org/downloads/
```

### Linux/macOS
```bash
brew install rclone
```

**Проверить установку:**
```bash
rclone version
```

---

## 🔑 Шаг 2: Подключить Google Drive (2 минуты)

```bash
rclone config
```

Просто нажимайте Enter на вопросы и выбирайте `google drive`:

```
e) Edit existing remote
n) New remote
d) Delete remote
r) Rename remote
c) Copy remote
s) Set configuration password
q) Quit config

e/n/d/r/c/s/q> n                          # Выберите: n

name> gdrive                               # Введите: gdrive

Type of storage> google drive              # Выберите Google Drive

Client ID>                                 # Оставьте пустым (Enter)
Client Secret>                            # Оставьте пустым (Enter)

Scopes: drive                             # Это норм

Service account file>                     # Оставьте пустым

Advanced>                                 # Ответьте: n
```

**Откроется браузер** - авторизуйтесь со своим Google аккаунтом и разрешите доступ.

Готово! 🎉

---

## 📦 Шаг 3: Первый бэкап

### Linux/macOS
```bash
cd /path/to/CRM\ 3.0
chmod +x backup-gdrive.sh
./backup-gdrive.sh
```

### Windows (PowerShell)
```powershell
cd "C:\Dev\CRM 3.0"
powershell -ExecutionPolicy Bypass -File backup-gdrive.ps1
```

**Что произойдёт:**
1. Создаст dump базы данных
2. Скопирует загруженные файлы
3. Архивирует всё
4. Загрузит на Google Drive в папку `CRM3_Backups`
5. Спросит удалить ли локальный файл

---

## ⏱️ Бонус: Автоматический ежедневный бэкап

### Linux/macOS (cron)
```bash
crontab -e

# Добавить строку (бэкап каждый день в 22:00):
0 22 * * * cd /path/to/CRM\ 3.0 && ./backup-gdrive.sh >> ./backups/backup.log 2>&1
```

### Windows (Task Scheduler)

1. Нажмите `Win + R`
2. Введите `taskschd.msc` (откроется Task Scheduler)
3. Нажмите **Create Basic Task**
4. Имя: `CRM 3.0 Daily Backup`
5. Trigger: **Daily** → 22:00
6. Action: **Start a program**
   ```
   Program: powershell.exe
   Arguments: -ExecutionPolicy Bypass -File "C:\Dev\CRM 3.0\backup-gdrive.ps1"
   ```
7. Нажмите **OK**

---

## ✅ Всё готово!

Теперь у вас есть:
- ✅ Автоматические бэкапы на Google Drive
- ✅ Защита данных в облаке
- ✅ Возможность восстановления в любой момент

**Для полной документации:**
- `GOOGLE_DRIVE_SETUP.md` - подробное руководство
- `BACKUP.md` - все способы бэкапов

---

## 🔍 Проверить бэкапы

```bash
# Список всех бэкапов на Google Drive
rclone ls "gdrive:CRM3_Backups/"

# Общий размер
rclone size "gdrive:CRM3_Backups/"
```

## 📥 Восстановить из бэкапа

```bash
# 1. Скачать файл
rclone copy "gdrive:CRM3_Backups/crm3_backup_20250111_150000.tar.gz" ./backups/

# 2. Распаковать и восстановить
cd backups
tar -xzf crm3_backup_*.tar.gz
../restore.sh crm3_backup_20250111_150000
```

---

## 🆘 Нужна помощь?

Смотрите раздел **Troubleshooting** в `GOOGLE_DRIVE_SETUP.md`
