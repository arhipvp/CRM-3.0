# CRM 3.0 Backup to Google Drive Script (PowerShell)
# Requires: rclone installed and Google Drive configured
# Usage: powershell -ExecutionPolicy Bypass -File backup-gdrive.ps1

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = ".\backups"
$BackupName = "crm3_backup_$Timestamp"
$GDrivePath = "CRM3_Backups"

Write-Host "🔄 Начинаем бэкап CRM 3.0 на Google Drive..." -ForegroundColor Cyan

# 1. Проверка rclone
if (!(Get-Command rclone -ErrorAction SilentlyContinue)) {
    Write-Host "❌ rclone не установлен!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Установите rclone:" -ForegroundColor Yellow
    Write-Host "  Windows (Chocolatey): choco install rclone"
    Write-Host "  Windows (Scoop):      scoop install rclone"
    Write-Host "  Или скачайте: https://rclone.org/downloads/"
    exit 1
}

# 2. Проверка Google Drive в rclone
$remotes = rclone listremotes
if ($remotes -notmatch "gdrive") {
    Write-Host "❌ Google Drive не настроен в rclone!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Выполните:" -ForegroundColor Yellow
    Write-Host "  rclone config"
    Write-Host ""
    Write-Host "Затем выберите 'n' (new remote) и следуйте инструкциям"
    exit 1
}

# 3. Создать папку для бэкапа
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
New-Item -ItemType Directory -Path "$BackupDir\$BackupName" -Force | Out-Null

# 4. Бэкап БД
Write-Host "📦 Создаём dump базы данных..." -ForegroundColor Yellow
docker-compose exec -T db pg_dump -U crm3 crm3 | Out-File -Encoding UTF8 "$BackupDir\$BackupName\database.sql"

# 5. Копируем загруженные файлы
if (Test-Path ".\backend\media") {
    Write-Host "📄 Копируем загруженные файлы..." -ForegroundColor Yellow
    Copy-Item -Path ".\backend\media\*" -Destination "$BackupDir\$BackupName\media" -Recurse -Force -ErrorAction SilentlyContinue
}

# 6. Копируем конфиги
Write-Host "⚙️  Копируем конфигурацию..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$BackupDir\$BackupName\config" -Force | Out-Null
if (Test-Path ".\backend\.env") { Copy-Item -Path ".\backend\.env" -Destination "$BackupDir\$BackupName\config\.env.backend" -Force }
if (Test-Path ".\frontend\.env") { Copy-Item -Path ".\frontend\.env" -Destination "$BackupDir\$BackupName\config\.env.frontend" -Force }
if (Test-Path ".\.env") { Copy-Item -Path ".\.env" -Destination "$BackupDir\$BackupName\config\.env.root" -Force }

# 7. Сохраняем информацию
Write-Host "📋 Сохраняем информацию о системе..." -ForegroundColor Yellow
$GitInfo = git log -1 --oneline
$GitBranch = git rev-parse --abbrev-ref HEAD

@"
CRM 3.0 Backup Information
==========================
Дата создания: $(Get-Date)
Git commit: $GitInfo
Git branch: $GitBranch

Загружено на Google Drive: $GDrivePath\$BackupName

Включено в бэкап:
- Database dump (database.sql)
- Media files (if any)
- Configuration files
- Backup info
"@ | Out-File "$BackupDir\$BackupName\backup_info.txt"

# 8. Архивируем
Write-Host "🗜️  Архивируем бэкап..." -ForegroundColor Yellow
Compress-Archive -Path "$BackupDir\$BackupName" -DestinationPath "$BackupDir\${BackupName}.zip" -Force
Remove-Item -Path "$BackupDir\$BackupName" -Recurse -Force

$FileSize = (Get-Item "$BackupDir\${BackupName}.zip").Length / 1MB
Write-Host "✅ Архив готов: $([Math]::Round($FileSize, 2)) MB" -ForegroundColor Green

# 9. Загружаем на Google Drive
Write-Host "☁️  Загружаем на Google Drive (это может занять время)..." -ForegroundColor Cyan
rclone copy "$BackupDir\${BackupName}.zip" "gdrive:$GDrivePath/"

Write-Host ""
Write-Host "✅ Бэкап успешно загружен на Google Drive!" -ForegroundColor Green
Write-Host "📍 Файл: $BackupDir\${BackupName}.zip"
Write-Host "☁️  Google Drive: $GDrivePath\${BackupName}.zip"
Write-Host "📊 Размер: $([Math]::Round($FileSize, 2)) MB"
Write-Host ""

# 10. Удалить локальный бэкап (опционально)
$DeleteLocal = Read-Host "Удалить локальный бэкап? (y/N)"
if ($DeleteLocal -eq 'y' -or $DeleteLocal -eq 'Y') {
    Remove-Item -Path "$BackupDir\${BackupName}.zip" -Force
    Write-Host "✓ Локальный бэкап удалён" -ForegroundColor Green
} else {
    Write-Host "✓ Локальный бэкап сохранён в $BackupDir\" -ForegroundColor Green
}

# 11. Показать загруженные файлы
Write-Host ""
Write-Host "Бэкапы на Google Drive:" -ForegroundColor Cyan
$files = rclone ls "gdrive:$GDrivePath/" 2>$null | Select-Object -Last 5
if ($files) {
    Write-Host $files
} else {
    Write-Host "  (бэкапы загружаются...)"
}

Write-Host ""
Write-Host "✓ Готово!" -ForegroundColor Green
