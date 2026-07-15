#!/bin/bash
# 单独更新前端
set -e

SERVER=${1:-"root@47.108.223.229"}
DEPLOY_DIR="/www/wwwroot/edu-evaluation-offline/deploy"

echo "📦 构建前端镜像..."
cd "$(dirname "$0")/../../frontend"
docker build -t edu-frontend:latest .

echo "💾 导出镜像..."
cd "$(dirname "$0")/.."
mkdir -p images
docker save edu-frontend:latest | gzip > images/edu-frontend.tar.gz

echo "📤 传输到服务器..."
scp images/edu-frontend.tar.gz $SERVER:$DEPLOY_DIR/images/

echo "🚀 部署..."
ssh $SERVER << 'EOF'
cd /www/wwwroot/edu-evaluation-offline/deploy/images
gunzip -c edu-frontend.tar.gz | docker load
cd ..
docker compose up -d frontend
EOF

echo "✅ 前端更新完成"
