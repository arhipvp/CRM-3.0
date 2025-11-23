#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

load_env() {
    if [ -f "$1" ]; then
        set -o allexport
        source "$1"
        set +o allexport
    fi
}

load_env ".env"
load_env "backend/.env"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_DIR="$PROJECT_ROOT/backups"
BACKUP_NAME="crm3_backup_${TIMESTAMP}"
GDRIVE_FOLDER_PATH="${GOOGLE_DRIVE_BACKUP_FOLDER_PATH:-}"
GDRIVE_FOLDER_ID="${GOOGLE_DRIVE_BACKUP_FOLDER_ID:-}"
if [ -n "$GDRIVE_FOLDER_PATH" ]; then
    GDRIVE_TARGET="$GDRIVE_FOLDER_PATH"
elif [ -n "$GDRIVE_FOLDER_ID" ]; then
    GDRIVE_TARGET="$GDRIVE_FOLDER_ID"
else
    GDRIVE_TARGET="CRM3_Backups"
fi
GDRIVE_DISPLAY_PATH="${GDRIVE_FOLDER_PATH:-${GDRIVE_FOLDER_ID:-CRM3_Backups}}"

ensure_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Command '$1' is required but not installed."
        exit 1
    fi
}

ensure_command docker-compose
ensure_command rclone

echo "🔄 Starting CRM 3.0 backup"
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

echo "📦 Dumping PostgreSQL database..."
docker-compose exec -T db pg_dump -U crm3 crm3 >"$BACKUP_DIR/$BACKUP_NAME/database.sql"

if [ -d "backend/media" ]; then
    echo "📄 Copying media files..."
    cp -r "backend/media" "$BACKUP_DIR/$BACKUP_NAME/" >/dev/null 2>&1 || true
fi

echo "⚙️ Copying configuration snapshots..."
mkdir -p "$BACKUP_DIR/$BACKUP_NAME/config"
[ -f "backend/.env" ] && cp "backend/.env" "$BACKUP_DIR/$BACKUP_NAME/config/.env.backend" || true
[ -f "frontend/.env" ] && cp "frontend/.env" "$BACKUP_DIR/$BACKUP_NAME/config/.env.frontend" || true
[ -f ".env" ] && cp ".env" "$BACKUP_DIR/$BACKUP_NAME/config/.env.root" || true

cat <<EOF >"$BACKUP_DIR/$BACKUP_NAME/backup_info.txt"
CRM 3.0 Backup Information
==========================
Date: $(date -u)
Git commit: $(git rev-parse --short HEAD)
Git branch: $(git rev-parse --abbrev-ref HEAD)

Google Drive path: $GDRIVE_DISPLAY_PATH/$BACKUP_NAME

Contents:
- database dump (database.sql)
- media directory (if present)
- configuration snapshots (.env files)
- this info file
EOF

echo "🗜️ Archiving backup..."
tar -czf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"

FILE_SIZE="$(du -h "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)"
echo "✅ Archive ready ($FILE_SIZE)"

echo "☁️ Uploading archive to Google Drive ($GDRIVE_DISPLAY_PATH/${BACKUP_NAME}.tar.gz)..."
rclone copy "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "gdrive:$GDRIVE_TARGET/"

if [ -d "$BACKUP_DIR/$BACKUP_NAME" ]; then
    echo "☁️ Uploading unpacked contents..."
    rclone copy "$BACKUP_DIR/$BACKUP_NAME/" "gdrive:$GDRIVE_TARGET/$BACKUP_NAME/"
    rm -rf "$BACKUP_DIR/$BACKUP_NAME"
fi

echo "🧾 Target folder snapshot:"
rclone lsf "gdrive:$GDRIVE_TARGET" | tail -n 5

SHARE_EMAIL="arhipvp@gmail.com"
if [ -n "${GOOGLE_DRIVE_BACKUP_FOLDER_ID:-}" ]; then
    echo ""
    echo "🔐 Granting read access for $SHARE_EMAIL..."
    VENV_DIR="$PROJECT_ROOT/.backup-gdrive-venv"
    if [ ! -d "$VENV_DIR" ]; then
        python3 -m venv "$VENV_DIR"
    fi
    "$VENV_DIR/bin/pip" install --upgrade pip google-auth google-api-python-client >/dev/null
    "$VENV_DIR/bin/python" <<'PY'
import os

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

keyfile = os.getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE", "credentials.json")
if not os.path.isabs(keyfile):
    keyfile = os.path.abspath(keyfile)
if not os.path.exists(keyfile) and os.path.exists("credentials.json"):
    keyfile = os.path.abspath("credentials.json")

folder_id = os.getenv("GOOGLE_DRIVE_BACKUP_FOLDER_ID")
email = os.getenv("SHARE_EMAIL", "arhipvp@gmail.com")
scopes = ["https://www.googleapis.com/auth/drive"]

creds = service_account.Credentials.from_service_account_file(
    keyfile, scopes=scopes
)
service = build("drive", "v3", credentials=creds, cache_discovery=False)
try:
    service.permissions().create(
        fileId=folder_id,
        body={
            "type": "user",
            "role": "reader",
            "emailAddress": email,
        },
        fields="id",
        sendNotificationEmail=False,
    ).execute()
    print(f"✅ Shared folder with {email}")
except HttpError as exc:
    if exc.resp.status == 409:
        print(f"ℹ️ {email} already has access")
    else:
        raise
PY
fi

echo ""
echo "🧹 Cleaning up local files..."
rm -rf "$BACKUP_DIR"

echo ""
echo "📦 Google Drive listing:"
rclone ls "gdrive:$GDRIVE_TARGET/" | tail -5
