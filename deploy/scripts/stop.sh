#!/bin/bash
# ============================================================
#  停止教育评估系统
#  用法: bash stop.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}    教育评估系统 - 停止服务          ${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

cd "$PROJECT_DIR"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行${NC}"
    exit 1
fi

echo -e "${YELLOW}正在停止服务...${NC}"
echo ""

# 停止服务
docker compose -f docker-compose.prod.yml down

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    所有服务已停止                    ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
