# 单独更新后端 (Windows PowerShell)
param(
    [string]$Server = "root@47.108.223.229",
    [string]$DeployDir = "/www/wwwroot/edu-evaluation-offline/deploy"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "📦 构建后端镜像..." -ForegroundColor Cyan
Set-Location "$ScriptDir\..\..\backend"
docker build -t edu-backend:latest .

Write-Host "💾 导出镜像..." -ForegroundColor Cyan
Set-Location "$ScriptDir\.."
New-Item -ItemType Directory -Force -Path images | Out-Null
docker save edu-backend:latest -o images\edu-backend.tar

Write-Host "📤 传输到服务器..." -ForegroundColor Cyan
scp images\edu-backend.tar "${Server}:${DeployDir}/images/"

Write-Host "🚀 部署..." -ForegroundColor Cyan
ssh $Server @"
cd /www/wwwroot/edu-evaluation-offline/deploy/images
docker load -i edu-backend.tar
cd ..
docker compose up -d backend
echo '⏳ 等待后端启动...'
sleep 15
docker compose ps backend
"@

Write-Host "✅ 后端更新完成" -ForegroundColor Green
