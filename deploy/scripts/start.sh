#!/bin/bash
# ============================================================
#  启动教育评估系统
#  用法: bash start.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    教育评估系统 - 启动服务          ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

cd "$PROJECT_DIR"

# 检查配置文件
if [ ! -f ".env" ]; then
    echo -e "${RED}错误: 配置文件 .env 不存在${NC}"
    echo -e "${YELLOW}请先复制并编辑配置文件:${NC}"
    echo "  cp .env.example .env"
    echo "  vim .env"
    exit 1
fi

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

echo -e "${YELLOW}正在启动服务...${NC}"
echo ""

# 启动服务
docker compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${YELLOW}等待服务就绪...${NC}"

# 等待服务健康
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
    healthy=$(docker compose -f docker-compose.prod.yml ps --format json 2>/dev/null | grep -c '"healthy"' || true)
    total=$(docker compose -f docker-compose.prod.yml ps --format json 2>/dev/null | wc -l || true)

    if [ "$healthy" -ge 5 ]; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}    所有服务已启动成功！              ${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "访问地址: ${GREEN}http://localhost${NC}"
        echo ""
        echo -e "默认账号:"
        echo -e "  管理员: ${YELLOW}admin${NC} / ${YELLOW}admin123${NC}"
        echo -e "  教师:   ${YELLOW}teacher01${NC} / ${YELLOW}teacher123${NC}"
        echo ""
        exit 0
    fi

    attempt=$((attempt + 1))
    echo -ne "\r${YELLOW}启动中... [$healthy/$total 服务就绪] ($attempt/$max_attempts)${NC}"
    sleep 2
done

echo ""
echo -e "${RED}警告: 部分服务可能未正常启动${NC}"
echo -e "${YELLOW}请检查日志: docker compose -f docker-compose.prod.yml logs${NC}"
exit 1
