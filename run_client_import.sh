#!/bin/bash
set -euo pipefail
cd /root/crm3
PGPASSWORD=$(grep -E '^PGPASSWORD=' backend/.env | cut -d'=' -f2-)
docker compose exec -e PGPASSWORD="$PGPASSWORD" backend psql -h db -U crm3 -d crm3 -c "DELETE FROM clients_client WHERE created_at = '2025-11-24 12:57:14';"
docker compose exec -e PGPASSWORD="$PGPASSWORD" backend psql -h db -U crm3 -d crm3 -f /app/client_import.sql
