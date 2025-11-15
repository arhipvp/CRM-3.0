#!/usr/bin/env bash
set -euo pipefail

cd backend

# Наполнить базу тестовыми записями из готового скрипта
python manage.py shell < populate_test_data.py
