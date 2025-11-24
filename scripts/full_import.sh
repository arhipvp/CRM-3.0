#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BACKUP_SQL="backup_2025-11-24_15-20.sql"
BACKUP_XLSX="backup_2025-11-24_15-20.xlsx"
for path in "$BACKUP_SQL" "$BACKUP_XLSX"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing required backup file: $path" >&2
    exit 1
  fi
done

DB_PASS=$(grep -E '^DJANGO_DB_PASSWORD=' .env | cut -d'=' -f2-)
if [[ -z "$DB_PASS" ]]; then
  echo "DJANGO_DB_PASSWORD not set in .env" >&2
  exit 1
fi

python3 transform_clients.py
python3 transform_deals.py

cp -f client_import.sql backend/client_import.sql
cp -f deal_import.sql backend/deal_import.sql
cp -f client_mapping.json backend/client_mapping.json

PG_CMD=(docker compose exec -e PGPASSWORD="$DB_PASS" backend psql -h db -U crm3 -d crm3)

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
docker compose exec -e PGPASSWORD="$DB_PASS" backend bash -c "cd /app && python scripts/import_business_data.py \"$BACKUP_XLSX\" --sheet policies"

echo "===> verification"
run_sql "SELECT COUNT(*) AS clients FROM clients_client;"
run_sql "SELECT COUNT(*) AS active_deals FROM deals_deal WHERE deleted_at IS NULL;"
run_sql "SELECT COUNT(*) AS hidden_deals FROM deals_deal WHERE deleted_at IS NOT NULL;"
run_sql "SELECT COUNT(*) AS policies FROM policies_policy;"
