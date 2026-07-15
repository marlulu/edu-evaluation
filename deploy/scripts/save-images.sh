#!/bin/bash
# ============================================================
#  保存 Docker 镜像（用于离线部署）
#  用法: bash save-images.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_DIR="$PROJECT_DIR/../docker-images"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  教育评估系统 - Docker 镜像保存工具  ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

cd "$PROJECT_DIR"

# 创建镜像目录
mkdir -p "$IMAGE_DIR"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

echo -e "${YELLOW}正在构建应用镜像...${NC}"
echo ""

# 构建应用镜像
docker compose -f docker-compose.prod.yml build

echo ""
echo -e "${YELLOW}正在保存镜像...${NC}"
echo ""

# 保存镜像
images=(
    "mysql:8.4"
    "redis:7-alpine"
    "minio/minio:latest"
    "edu-frontend:latest"
    "edu-backend:latest"
    "edu-ai-worker:latest"
)

saved=0
failed=0

for image in "${images[@]}"; do
    # 生成文件名
    filename=$(echo "$image" | sed 's/[\/:]/-/g').tar.gz
    echo -n -e "保存 ${YELLOW}$image${NC} -> ${YELLOW}$filename${NC} ... "

    if docker save "$image" | gzip > "$IMAGE_DIR/$filename" 2>/dev/null; then
        size=$(du -h "$IMAGE_DIR/$filename" | cut -f1)
        echo -e "${GREEN}成功${NC} ($size)"
        saved=$((saved + 1))
    else
        echo -e "${RED}失败${NC}"
        failed=$((failed + 1))
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "保存完成: ${GREEN}$saved 成功${NC}, ${RED}$failed 失败${NC}"
echo -e "镜像目录: ${YELLOW}$IMAGE_DIR${NC}"
echo -e "${GREEN}========================================${NC}"

# 显示镜像大小
echo ""
echo -e "${YELLOW}镜像文件大小:${NC}"
du -sh "$IMAGE_DIR"/*.tar.gz 2>/dev/null || true
echo ""
echo -e "总计: $(du -sh "$IMAGE_DIR" | cut -f1)"
