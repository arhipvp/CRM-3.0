[CmdletBinding()]
param(
    [switch]$SkipWebBuild
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $OutputEncoding
[Console]::OutputEncoding = $OutputEncoding
chcp 65001 | Out-Null

$toolRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $toolRoot '.venv\Scripts\python.exe'
$webRoot = Join-Path $toolRoot 'web'
$envFile = Join-Path $toolRoot '.env'

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Не найдена команда $Name. Установите её и повторите запуск."
    }
}

Require-Command docker
Require-Command codex
Require-Command npm
Require-Command python

$codexExecutable = (Get-Command codex.exe -ErrorAction SilentlyContinue).Source
if (-not $codexExecutable) {
    $codexExecutable = (Get-Command codex.cmd -ErrorAction SilentlyContinue).Source
}
if (-not $codexExecutable) {
    throw 'Не найден исполняемый файл Codex CLI (codex.exe или codex.cmd).'
}

if (Test-Path $envFile) {
    Get-Content -Encoding utf8 $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            Set-Item -Path ("Env:" + $Matches[1]) -Value $Matches[2]
        }
    }
}

if (-not (Test-Path $venvPython)) {
    Write-Host 'Создаю локальное виртуальное окружение...'
    python -m venv (Join-Path $toolRoot '.venv')
}

& $venvPython -c 'import fastapi, httpx, qdrant_client' 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Устанавливаю Python-зависимости помощника...'
    & $venvPython -m pip install -r (Join-Path $toolRoot 'requirements.txt')
}

if (-not $SkipWebBuild) {
    Push-Location $webRoot
    try {
        if (-not (Test-Path (Join-Path $webRoot 'node_modules'))) {
            Write-Host 'Устанавливаю зависимости веб-интерфейса...'
            npm ci
        }
        npm run build
    }
    finally {
        Pop-Location
    }
}

Push-Location $toolRoot
try {
    docker compose -f docker-compose.local.yml up -d
    $codexStatus = & $codexExecutable login status 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Codex CLI не авторизован. Выполните 'codex login', затем повторите запуск."
    }

    $env:INSURANCE_ASSISTANT_HOST = '127.0.0.1'
    $env:INSURANCE_ASSISTANT_PORT = '8765'
    Start-Process 'http://127.0.0.1:8765'
    Write-Host 'Страховой помощник запущен: http://127.0.0.1:8765'
    & $venvPython -m insurance_assistant
}
finally {
    Pop-Location
}
