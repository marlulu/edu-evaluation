#!/bin/bash
# 单独更新后端
set -e

SERVER=${1:-"root@47.108.223.229"}
DEPLOY_DIR="/www/wwwroot/edu-evaluation-offline/deploy"

echo "📦 构建后端镜像..."
cd "$(dirname "$0")/../../backend"
docker build -t edu-backend:latest .

echo "💾 导出镜像..."
cd "$(dirname "$0")/.."
mkdir -p images
docker save edu-backend:latest | gzip > images/edu-backend.tar.gz

echo "📤 传输到服务器..."
scp images/edu-backend.tar.gz $SERVER:$DEPLOY_DIR/images/

echo "🚀 部署..."
ssh $SERVER << 'EOF'
cd /www/wwwroot/edu-evaluation-offline/deploy/images
gunzip -c edu-backend.tar.gz | docker load
cd ..
docker compose up -d backend
echo "⏳ 等待后端启动..."
sleep 15
docker compose ps backend
EOF

echo "✅ 后端更新完成"
