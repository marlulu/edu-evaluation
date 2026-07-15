#!/bin/bash
# 单独更新 AI Worker
set -e

SERVER=${1:-"root@47.108.223.229"}
DEPLOY_DIR="/www/wwwroot/edu-evaluation-offline/deploy"

echo "📦 构建 AI Worker 镜像..."
cd "$(dirname "$0")/../../ai-worker"
docker build -t edu-ai-worker:latest .

echo "💾 导出镜像..."
cd "$(dirname "$0")/.."
mkdir -p images
docker save edu-ai-worker:latest | gzip > images/edu-ai-worker.tar.gz

echo "📤 传输到服务器..."
scp images/edu-ai-worker.tar.gz $SERVER:$DEPLOY_DIR/images/

echo "🚀 部署..."
ssh $SERVER << 'EOF'
cd /www/wwwroot/edu-evaluation-offline/deploy/images
gunzip -c edu-ai-worker.tar.gz | docker load
cd ..
docker compose up -d ai-worker
EOF

echo "✅ AI Worker 更新完成"
