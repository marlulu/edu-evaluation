# 单独更新 AI Worker (Windows PowerShell)
param(
    [string]$Server = "root@47.108.223.229",
    [string]$DeployDir = "/www/wwwroot/edu-evaluation-offline/deploy"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "📦 构建 AI Worker 镜像..." -ForegroundColor Cyan
Set-Location "$ScriptDir\..\..\ai-worker"
docker build -t edu-ai-worker:latest .

Write-Host "💾 导出镜像..." -ForegroundColor Cyan
Set-Location "$ScriptDir\.."
New-Item -ItemType Directory -Force -Path images | Out-Null
docker save edu-ai-worker:latest -o images\edu-ai-worker.tar

Write-Host "📤 传输到服务器..." -ForegroundColor Cyan
scp images\edu-ai-worker.tar "${Server}:${DeployDir}/images/"

Write-Host "🚀 部署..." -ForegroundColor Cyan
ssh $Server @"
cd /www/wwwroot/edu-evaluation-offline/deploy/images
docker load -i edu-ai-worker.tar
cd ..
docker compose up -d ai-worker
"@

Write-Host "✅ AI Worker 更新完成" -ForegroundColor Green
