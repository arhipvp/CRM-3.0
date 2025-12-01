#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

IMPORT_DATA_DIR="$REPO_ROOT/import/data"
BACKUP_SQL="$IMPORT_DATA_DIR/backup_2025-11-24_15-20.sql"
BACKUP_XLSX="$IMPORT_DATA_DIR/backup_2025-11-24_15-20.xlsx"
ENV_FILE=".env"

usage() {
  cat <<EOF
Usage: $0 [--backup-sql PATH] [--backup-xlsx PATH] [--env-file PATH]

  --backup-sql PATH    path to historical SQL dump (default: ${BACKUP_SQL})
  --backup-xlsx PATH   path to Excel export (default: ${BACKUP_XLSX})
  --env-file PATH      env file to source for DJANGO_DB_PASSWORD (default: ${ENV_FILE})
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --backup-sql)
      BACKUP_SQL=$2
      shift 2
      ;;
    --backup-xlsx)
      BACKUP_XLSX=$2
      shift 2
      ;;
    --env-file)
      ENV_FILE=$2
      shift 2
      ;;
    --help|-h)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

for path in "$BACKUP_SQL" "$BACKUP_XLSX"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing required backup file: $path" >&2
    exit 1
  fi
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file ${ENV_FILE} not found." >&2
  exit 1
fi

DB_PASS=$(grep -E '^DJANGO_DB_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2-)
if [[ -z "$DB_PASS" ]]; then
  echo "DJANGO_DB_PASSWORD not set in ${ENV_FILE}" >&2
  exit 1
fi

python3 transform_clients.py
python3 transform_deals.py

cp -f "$IMPORT_DATA_DIR/client_import.sql" backend/client_import.sql
cp -f "$IMPORT_DATA_DIR/deal_import.sql" backend/deal_import.sql
cp -f "$IMPORT_DATA_DIR/client_mapping.json" backend/client_mapping.json
mkdir -p backend/import/data
BACKUP_XLSX_FILENAME="$(basename "$BACKUP_XLSX")"
cp -f "$BACKUP_XLSX" backend/import/data/"$BACKUP_XLSX_FILENAME"
BACKUP_XLSX_CONTAINER="/app/import/data/${BACKUP_XLSX_FILENAME}"

PG_CMD=(docker compose -f docker-compose.prod.yml exec -e PGPASSWORD="$DB_PASS" backend psql -h db -U crm3 -d crm3)

run_sql() {
  echo "+ ${PG_CMD[*]} -c '$1'"
  "${PG_CMD[@]}" -c "$1"
}

run_file() {
  echo "+ ${PG_CMD[*]} -f $1"
  "${PG_CMD[@]}" -f "$1"
}

echo "===> truncating clients+related (cascade)"
run_sql "TRUNCATE TABLE clients_client CASCADE;"

echo "===> loading clients"
run_file /app/client_import.sql

echo "===> loading deals"
run_file /app/deal_import.sql

echo "===> truncating policies"
run_sql "TRUNCATE TABLE policies_policy CASCADE;"

echo "===> importing policies from Excel"
docker compose -f docker-compose.prod.yml exec -e PGPASSWORD="$DB_PASS" backend bash -c "cd /app && python scripts/import_business_data.py \"$BACKUP_XLSX_CONTAINER\" --sheet policies"

echo "===> truncating payments and financial records"
run_sql "TRUNCATE TABLE finances_financialrecord CASCADE;"
run_sql "TRUNCATE TABLE finances_payment CASCADE;"

echo "===> importing payments from Excel"
docker compose -f docker-compose.prod.yml exec -e PGPASSWORD="$DB_PASS" backend bash -c "cd /app && python scripts/import_business_data.py \"$BACKUP_XLSX_CONTAINER\" --sheet payments"

echo "===> importing incomes from Excel"
docker compose -f docker-compose.prod.yml exec -e PGPASSWORD="$DB_PASS" backend bash -c "cd /app && python scripts/import_business_data.py \"$BACKUP_XLSX_CONTAINER\" --sheet incomes"

echo "===> importing expenses from Excel"
docker compose -f docker-compose.prod.yml exec -e PGPASSWORD="$DB_PASS" backend bash -c "cd /app && python scripts/import_business_data.py \"$BACKUP_XLSX_CONTAINER\" --sheet expenses"

echo "===> verification"
run_sql "SELECT COUNT(*) AS clients FROM clients_client;"
run_sql "SELECT COUNT(*) AS active_deals FROM deals_deal WHERE deleted_at IS NULL;"
run_sql "SELECT COUNT(*) AS hidden_deals FROM deals_deal WHERE deleted_at IS NOT NULL;"
run_sql "SELECT COUNT(*) AS policies FROM policies_policy;"
run_sql "SELECT COUNT(*) AS payments FROM finances_payment;"
run_sql "SELECT COUNT(*) AS financial_records FROM finances_financialrecord;"
