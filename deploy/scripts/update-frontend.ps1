# 单独更新前端 (Windows PowerShell)
param(
    [string]$Server = "root@47.108.223.229",
    [string]$DeployDir = "/www/wwwroot/edu-evaluation-offline/deploy"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "📦 构建前端镜像..." -ForegroundColor Cyan
Set-Location "$ScriptDir\..\..\frontend"
docker build -t edu-frontend:latest .

Write-Host "💾 导出镜像..." -ForegroundColor Cyan
Set-Location "$ScriptDir\.."
New-Item -ItemType Directory -Force -Path images | Out-Null
docker save edu-frontend:latest -o images\edu-frontend.tar

Write-Host "📤 传输到服务器..." -ForegroundColor Cyan
scp images\edu-frontend.tar "${Server}:${DeployDir}/images/"

Write-Host "🚀 部署..." -ForegroundColor Cyan
ssh $Server @"
cd /www/wwwroot/edu-evaluation-offline/deploy/images
docker load -i edu-frontend.tar
cd ..
docker compose up -d frontend
"@

Write-Host "✅ 前端更新完成" -ForegroundColor Green
