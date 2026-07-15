#!/bin/bash
# ============================================================
#  加载 Docker 镜像脚本
#  用法: bash load-images.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_DIR="$PROJECT_DIR/../docker-images"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  教育评估系统 - Docker 镜像加载工具  ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

# 检查镜像目录
if [ ! -d "$IMAGE_DIR" ]; then
    echo -e "${RED}错误: 镜像目录不存在: $IMAGE_DIR${NC}"
    exit 1
fi

# 统计镜像数量
image_count=$(ls -1 "$IMAGE_DIR"/*.tar.gz 2>/dev/null | wc -l)
if [ "$image_count" -eq 0 ]; then
    echo -e "${RED}错误: 未找到镜像文件 (.tar.gz)${NC}"
    exit 1
fi

echo -e "${YELLOW}找到 $image_count 个镜像文件${NC}"
echo ""

# 加载镜像
loaded=0
failed=0

for image in "$IMAGE_DIR"/*.tar.gz; do
    filename=$(basename "$image")
    echo -n -e "加载 ${YELLOW}$filename${NC} ... "

    if docker load < "$image" > /dev/null 2>&1; then
        echo -e "${GREEN}成功${NC}"
        loaded=$((loaded + 1))
    else
        echo -e "${RED}失败${NC}"
        failed=$((failed + 1))
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "加载完成: ${GREEN}$loaded 成功${NC}, ${RED}$失败 失败${NC}"
echo -e "${GREEN}========================================${NC}"

# 显示已加载的镜像
echo ""
echo -e "${YELLOW}已加载的镜像:${NC}"
docker images | grep -E "mysql|redis|minio|nginx|backend|ai-worker" | head -20

if [ "$failed" -gt 0 ]; then
    exit 1
fi
