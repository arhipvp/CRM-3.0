#!/bin/bash
# Скрипт для диагностики проблем с фронтендом

echo "=== Проверка контейнеров ==="
docker ps | grep -E "crm3-frontend|crm3-nginx"

echo -e "\n=== Логи фронтенда (последние 20 строк) ==="
docker logs crm3-frontend --tail 20

echo -e "\n=== Логи nginx (последние 20 строк) ==="
docker logs crm3-nginx --tail 20

echo -e "\n=== Проверка доступности фронтенда изнутри сети Docker ==="
docker exec crm3-nginx wget -qO- http://frontend:5173/ | head -20

echo -e "\n=== Проверка index.css ==="
docker exec crm3-frontend test -f /app/src/index.css && echo "✓ index.css существует" || echo "✗ index.css не найден"

echo -e "\n=== Инструкции ==="
echo "1. Откройте консоль браузера (F12) и проверьте вкладку Network"
echo "2. Перезагрузите страницу и проверьте, загружаются ли CSS файлы"
echo "3. Проверьте, нет ли ошибок 404 для CSS/JS файлов"
echo "4. Если есть ошибки, скопируйте их и отправьте"

