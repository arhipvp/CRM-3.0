#!/bin/bash

# CRM 3.0 Backup to Google Drive Script
# Требует установленный rclone с настроенным Google Drive

set -e

# Load local env overrides so we can reuse the same folder IDs.
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
fi

if [ -f backend/.env ]; then
    set -o allexport
    source backend/.env
    set +o allexport
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_NAME="crm3_backup_${TIMESTAMP}"
GDRIVE_PATH="${GOOGLE_DRIVE_BACKUP_FOLDER_ID:-CRM3_Backups}"  # Папка на Google Drive

# Проверка установки rclone
if ! command -v rclone &> /dev/null; then
    echo "❌ rclone не установлен!"
    echo ""
    echo "Установите rclone:"
    echo "  Linux/macOS:  brew install rclone"
    echo "  Windows:      choco install rclone"
    echo "  Или скачайте с https://rclone.org/downloads/"
    exit 1
fi

# Проверка настройки Google Drive в rclone
if ! rclone listremotes | grep -q "gdrive"; then
    echo "❌ Google Drive не настроен в rclone!"
    echo ""
    echo "Выполните:"
    echo "  rclone config"
    echo ""
    echo "Затем выберите 'n' (new remote) и следуйте инструкциям для Google Drive"
    exit 1
fi

echo "🔄 Начинаем бэкап CRM 3.0 на Google Drive..."
mkdir -p "$BACKUP_DIR"

# 1. Бэкап PostgreSQL БД
echo "📦 Создаём dump базы данных..."
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
docker-compose exec -T db pg_dump -U crm3 crm3 > "$BACKUP_DIR/$BACKUP_NAME/database.sql"

# 2. Бэкап загруженных файлов
if [ -d "./backend/media" ]; then
    echo "📄 Копируем загруженные файлы..."
    cp -r ./backend/media "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true
fi

# 3. Копируем конфиги
echo "⚙️  Копируем конфигурацию..."
mkdir -p "$BACKUP_DIR/$BACKUP_NAME/config"
[ -f "./backend/.env" ] && cp ./backend/.env "$BACKUP_DIR/$BACKUP_NAME/config/.env.backend" || true
[ -f "./frontend/.env" ] && cp ./frontend/.env "$BACKUP_DIR/$BACKUP_NAME/config/.env.frontend" || true
[ -f "./.env" ] && cp ./.env "$BACKUP_DIR/$BACKUP_NAME/config/.env.root" || true

# 4. Сохраняем информацию
echo "📋 Сохраняем информацию о системе..."
cat > "$BACKUP_DIR/$BACKUP_NAME/backup_info.txt" << EOF
CRM 3.0 Backup Information
==========================
Дата создания: $(date)
Git commit: $(git log -1 --oneline)
Git branch: $(git rev-parse --abbrev-ref HEAD)

Загружено на Google Drive: $GDRIVE_PATH/$BACKUP_NAME

Включено в бэкап:
- Database dump (database.sql)
- Media files (if any)
- Configuration files
- Backup info
EOF

# 5. Архивируем
echo "🗜️  Архивируем бэкап..."
tar -czf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"

FILE_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)
echo "✅ Архив готов: $FILE_SIZE"

# 6. Загружаем на Google Drive
echo "☁️  Загружаем на Google Drive..."
echo "GDRIVE_PATH=$GDRIVE_PATH"
rclone copy "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "gdrive:$GDRIVE_PATH/"

if [ -d "$BACKUP_DIR/$BACKUP_NAME" ]; then
    echo "☁️  Загружаем распакованный бэкап..."
    rclone copy "$BACKUP_DIR/$BACKUP_NAME/" "gdrive:$GDRIVE_PATH/$BACKUP_NAME/"
    rm -rf "$BACKUP_DIR/$BACKUP_NAME"
fi

echo ""
echo "✅ Бэкап успешно загружен на Google Drive!"
echo "📍 Файл: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo "☁️  Google Drive: $GDRIVE_PATH/${BACKUP_NAME}.tar.gz"
echo "📊 Размер: $FILE_SIZE"
echo ""

# Удаляем локальный архив (опционально)
read -p "Удалить локальный бэкап? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm "$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    echo "✓ Локальный бэкап удалён"
else
    echo "✓ Локальный бэкап сохранён в $BACKUP_DIR/"
fi

# Проверить загруженные файлы на Google Drive
echo ""
echo "Бэкапы на Google Drive:"
rclone ls "gdrive:$GDRIVE_PATH/" | tail -5
