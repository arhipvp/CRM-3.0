#!/bin/bash

# CRM 3.0 Backup Script
# Создает полный бекап БД и загруженных файлов

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_NAME="crm3_backup_${TIMESTAMP}"

# Создать папку для бекапов если её нет
mkdir -p "$BACKUP_DIR"

echo "🔄 Начинаем бекап CRM 3.0..."
echo "Папка бекапа: $BACKUP_DIR/$BACKUP_NAME"

# 1. Бекап PostgreSQL БД
echo "📦 Создаём dump базы данных..."
docker-compose exec -T db pg_dump -U crm3 crm3 > "$BACKUP_DIR/$BACKUP_NAME/database.sql"

# 2. Бекап загруженных файлов (если есть)
if [ -d "./backend/media" ]; then
    echo "📄 Копируем загруженные файлы..."
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/media"
    cp -r ./backend/media/* "$BACKUP_DIR/$BACKUP_NAME/media/" 2>/dev/null || true
fi

# 3. Копируем .env файлы для восстановления
echo "⚙️  Копируем конфигурацию..."
mkdir -p "$BACKUP_DIR/$BACKUP_NAME/config"
[ -f "./backend/.env" ] && cp ./backend/.env "$BACKUP_DIR/$BACKUP_NAME/config/.env.backend" || true
[ -f "./frontend/.env" ] && cp ./frontend/.env "$BACKUP_DIR/$BACKUP_NAME/config/.env.frontend" || true
[ -f "./.env" ] && cp ./.env "$BACKUP_DIR/$BACKUP_NAME/config/.env.root" || true

# 4. Сохраняем информацию о версиях
echo "📋 Сохраняем информацию о системе..."
cat > "$BACKUP_DIR/$BACKUP_NAME/backup_info.txt" << EOF
CRM 3.0 Backup Information
==========================
Дата создания: $(date)
Git commit: $(git log -1 --oneline)
Git branch: $(git rev-parse --abbrev-ref HEAD)

Включено в бекап:
- Database dump (database.sql)
- Media files (if any)
- Configuration files
- Backup info

Для восстановления используйте: ./restore.sh $BACKUP_NAME
EOF

# 5. Создаём архив
echo "🗜️  Архивируем бекап..."
tar -czf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"
rm -rf "$BACKUP_DIR/$BACKUP_NAME"

echo ""
echo "✅ Бекап завершён успешно!"
echo "📍 Файл: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo "📊 Размер: $(du -h "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)"
echo ""
echo "Список доступных бекапов:"
ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "  (нет предыдущих бекапов)"
