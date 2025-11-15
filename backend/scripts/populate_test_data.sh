#!/usr/bin/env bash
set -euo pipefail

# Затягивается в контейнере backend, рабочая директория /app
python manage.py shell < populate_test_data.py
