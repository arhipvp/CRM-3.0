#!/usr/bin/env bash
set -euo pipefail

cd backend

# Очистить данные (удаляет все строки из зарегистрированных моделей)
python manage.py flush --no-input

# Применить миграции заново
python manage.py migrate
