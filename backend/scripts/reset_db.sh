#!/usr/bin/env bash
set -euo pipefail

# Запускается внутри контейнера backend, корневая директория уже /app

python manage.py flush --no-input
python manage.py migrate
