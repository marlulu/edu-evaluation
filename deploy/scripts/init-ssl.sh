#!/bin/bash
# ============================================================
#  初始化 SSL 证书 (Let's Encrypt)
#  首次部署时运行一次
# ============================================================

set -e
cd "$(dirname "$0")/.."

DOMAIN="marwind.top"
EMAIL="${1:-admin@marwind.top}"

echo "=== 初始化 SSL 证书: $DOMAIN ==="

# 1. 先用 HTTP 启动 nginx（临时配置）
echo "[1/3] 启动临时 HTTP 服务..."
docker compose -f docker-compose.prod.yml up -d frontend

# 2. 申请证书
echo "[2/3] 申请 Let's Encrypt 证书..."
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

# 3. 复制证书到 nginx 目录
echo "[3/3] 复制证书..."
docker compose -f docker-compose.prod.yml exec frontend sh -c '
  cp /etc/letsencrypt/live/'"$DOMAIN"'/fullchain.pem /etc/nginx/ssl/fullchain.pem 2>/dev/null || \
  cp /etc/letsencrypt/archive/'"$DOMAIN"'/fullchain1.pem /etc/nginx/ssl/fullchain.pem
  cp /etc/letsencrypt/live/'"$DOMAIN"'/privkey.pem /etc/nginx/ssl/privkey.pem 2>/dev/null || \
  cp /etc/letsencrypt/archive/'"$DOMAIN"'/privkey1.pem /etc/nginx/ssl/privkey.pem
'

# 4. 重启 nginx 加载 SSL
echo "重启 Nginx..."
docker compose -f docker-compose.prod.yml restart frontend

echo ""
echo "=== SSL 证书初始化完成 ==="
echo "访问: https://$DOMAIN"
