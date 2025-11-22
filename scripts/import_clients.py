from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import django
from openpyxl import load_workbook

# Ensure the backend can be imported by adjusting sys.path before Django setup.
BASE_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.clients.importers.excel_clients import (
    build_client_payload,
    read_client_rows,
    resolve_creator,
)
from apps.clients.models import Client


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Создаёт клиентов из Excel-файла.")
    parser.add_argument("path", help="путь до Excel-файла (.xlsx)")
    parser.add_argument("--sheet", help="имя листа (по умолчанию первый)")
    parser.add_argument(
        "--created-by",
        help="id/email/username пользователя, который станет создателем клиента",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="проверить данные без записи в базу",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    creator = None
    if args.created_by:
        try:
            creator = resolve_creator(args.created_by)
        except ValueError as exc:
            print(f"ошибка с created_by: {exc}")
            sys.exit(1)

    workbook = load_workbook(filename=args.path, data_only=True)
    sheet = workbook[args.sheet] if args.sheet else workbook.active
    rows = read_client_rows(sheet)

    if not rows:
        print("Файл не содержит данных для импорта.")
        return

    instances = []
    for row_number, row_data in rows:
        try:
            payload = build_client_payload(row_data, creator)
        except ValueError as exc:
            print(f"строка {row_number}: {exc}")
            sys.exit(1)

        instances.append(Client(**payload))

    print(f"Загружено строк: {len(rows)}; подготовлено объектов: {len(instances)}.")

    if args.dry_run:
        print("Dry run — ничего не сохраняю.")
        return

    Client.objects.bulk_create(instances)
    print(f"Создано клиентов: {len(instances)}")


if __name__ == "__main__":
    main()
