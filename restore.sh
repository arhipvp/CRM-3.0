#!/bin/bash

# CRM 3.0 Restore Script
# Восстанавливает БД и файлы из бекапа

set -e

if [ -z "$1" ]; then
    echo "❌ Ошибка: укажите имя бекапа"
    echo ""
    echo "Использование: ./restore.sh <backup_name>"
    echo ""
    echo "Доступные бекапы:"
    ls -1 ./backups/*.tar.gz 2>/dev/null | sed 's/.*\///' | sed 's/.tar.gz//' || echo "  (нет доступных бекапов)"
    exit 1
fi

BACKUP_NAME=$1
BACKUP_FILE="./backups/${BACKUP_NAME}.tar.gz"
BACKUP_DIR="./backups/${BACKUP_NAME}"

# Проверка наличия файла бекапа
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Файл не найден: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Восстанавливаем CRM 3.0 из бекапа..."
echo "Бекап: $BACKUP_NAME"
echo ""

# Проверка что контейнеры запущены
if ! docker compose ps | grep -q "db"; then
    echo "⚠️  БД контейнер не запущен. Запускаем docker compose..."
    docker compose up -d
    sleep 10
fi

# 1. Распаковываем бекап
echo "📦 Распаковываем архив..."
mkdir -p "$BACKUP_DIR"
tar -xzf "$BACKUP_FILE" -C ./backups

# 2. Восстанавливаем БД
echo "🗄️  Восстанавливаем базу данных..."
docker compose exec -T db dropdb -U crm3 crm3 --if-exists
docker compose exec -T db createdb -U crm3 crm3
docker compose exec -T db psql -U crm3 crm3 < "$BACKUP_DIR/$BACKUP_NAME/database.sql"

# 3. Восстанавливаем загруженные файлы
if [ -d "$BACKUP_DIR/$BACKUP_NAME/media" ] && [ "$(ls -A $BACKUP_DIR/$BACKUP_NAME/media)" ]; then
    echo "📄 Восстанавливаем загруженные файлы..."
    mkdir -p ./backend/media
    cp -r "$BACKUP_DIR/$BACKUP_NAME/media/"* ./backend/media/ 2>/dev/null || true
fi

# 4. Восстанавливаем конфиги (только если указаны)
if [ -d "$BACKUP_DIR/$BACKUP_NAME/config" ]; then
    echo "⚙️  Обновляем конфигурацию..."
    [ -f "$BACKUP_DIR/$BACKUP_NAME/config/.env.backend" ] && cp "$BACKUP_DIR/$BACKUP_NAME/config/.env.backend" ./backend/.env || true
    [ -f "$BACKUP_DIR/$BACKUP_NAME/config/.env.frontend" ] && cp "$BACKUP_DIR/$BACKUP_NAME/config/.env.frontend" ./frontend/.env || true
    [ -f "$BACKUP_DIR/$BACKUP_NAME/config/.env.root" ] && cp "$BACKUP_DIR/$BACKUP_NAME/config/.env.root" ./.env || true
fi

# 5. Показываем информацию из бекапа
if [ -f "$BACKUP_DIR/$BACKUP_NAME/backup_info.txt" ]; then
    echo ""
    cat "$BACKUP_DIR/$BACKUP_NAME/backup_info.txt"
fi

# Очистка временных файлов
rm -rf "$BACKUP_DIR"

echo ""
echo "✅ Восстановление завершено успешно!"
echo ""
echo "Следующие шаги:"
echo "  1. docker compose restart backend  # Перезагрузить бэкенд"
echo "  2. Проверить что всё работает"
echo "  3. docker compose logs -f backend  # Смотреть логи"
