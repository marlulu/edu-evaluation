#!/bin/bash
# ============================================================
#  教育评估系统 — 离线打包脚本
#  用法: bash offline-package.sh [--images|--code|--all|--help]
#  在有网络的机器上运行，生成离线部署包
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 路径配置
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$PROJECT_ROOT/deploy"
OUTPUT_DIR="$PROJECT_ROOT/offline-package"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="edu-evaluation-offline-${TIMESTAMP}"

# Docker 镜像列表
IMAGES=(
    "mysql:8.4"
    "redis:7-alpine"
    "minio/minio:latest"
    "rabbitmq:4-management"
    "nginx:alpine"
    "eclipse-temurin:17-jre-alpine"
    "python:3.11-slim"
)

# 打印带颜色的消息
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查依赖
check_deps() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装"
        exit 1
    fi
    if ! command -v tar &> /dev/null; then
        print_error "tar 未安装"
        exit 1
    fi
}

# 创建输出目录
prepare_output() {
    print_info "准备输出目录..."
    rm -rf "$OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR/${PACKAGE_NAME}"
    mkdir -p "$OUTPUT_DIR/${PACKAGE_NAME}/images"
    mkdir -p "$OUTPUT_DIR/${PACKAGE_NAME}/code"
    mkdir -p "$OUTPUT_DIR/${PACKAGE_NAME}/config"
}

# 拉取并保存 Docker 镜像
package_images() {
    print_info "开始打包 Docker 镜像..."

    cd "$OUTPUT_DIR/${PACKAGE_NAME}/images"

    for image in "${IMAGES[@]}"; do
        print_info "拉取镜像: $image"
        docker pull "$image"

        # 生成安全的文件名
        filename=$(echo "$image" | sed 's/[\/:]/_/g').tar
        print_info "保存镜像: $image -> $filename"
        docker save -o "$filename" "$image"

        # 压缩
        print_info "压缩: $filename"
        gzip "$filename"
    done

    # 生成镜像清单
    cat > images.txt <<'EOF'
# 镜像加载顺序（按依赖关系）
1. mysql:8.4
2. redis:7-alpine
3. minio/minio:latest
4. rabbitmq:4-management
5. eclipse-temurin:17-jre-alpine
6. python:3.11-slim
7. nginx:alpine
EOF

    print_success "Docker 镜像打包完成"
}

# 打包项目代码
package_code() {
    print_info "开始打包项目代码..."

    cd "$PROJECT_ROOT"

    # 创建代码压缩包（排除不需要的文件）
    tar -czf "$OUTPUT_DIR/${PACKAGE_NAME}/code/edu-evaluation.tar.gz" \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='target' \
        --exclude='__pycache__' \
        --exclude='.env' \
        --exclude='*.log' \
        --exclude='offline-package' \
        --exclude='infra/.venv' \
        .

    print_success "项目代码打包完成"
}

# 打包配置文件
package_config() {
    print_info "打包配置文件..."

    cd "$OUTPUT_DIR/${PACKAGE_NAME}/config"

    # 复制部署配置
    cp "$DEPLOY_DIR/docker-compose.prod.yml" .
    cp "$DEPLOY_DIR/.env.example" .env.production
    cp "$DEPLOY_DIR/.env.production" . 2>/dev/null || true
    cp -r "$DEPLOY_DIR/nginx" .
    cp -r "$DEPLOY_DIR/mysql" .
    cp -r "$DEPLOY_DIR/scripts" .

    # 复制 Dockerfile（用于离线构建）
    mkdir -p backend ai-worker frontend
    cp "$PROJECT_ROOT/backend/Dockerfile" backend/
    cp "$PROJECT_ROOT/ai-worker/Dockerfile" ai-worker/
    if [ -f "$PROJECT_ROOT/frontend/Dockerfile" ]; then
        cp "$PROJECT_ROOT/frontend/Dockerfile" frontend/
    fi

    print_success "配置文件打包完成"
}

# 生成部署脚本
generate_deploy_script() {
    print_info "生成离线部署脚本..."

    cat > "$OUTPUT_DIR/${PACKAGE_NAME}/deploy-offline.sh" <<'DEPLOY_SCRIPT'
#!/bin/bash
# ============================================================
#  教育评估系统 — 离线部署脚本
#  用法: bash deploy-offline.sh [--load|--deploy|--all|--help]
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="/opt/edu-evaluation"

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        print_info "安装命令: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker 服务未启动"
        print_info "启动命令: sudo systemctl start docker"
        exit 1
    fi

    # 检查 Docker Compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        print_error "Docker Compose 未安装"
        exit 1
    fi
}

# 加载 Docker 镜像
load_images() {
    print_info "开始加载 Docker 镜像..."

    cd "$SCRIPT_DIR/images"

    for image_file in *.tar.gz; do
        if [ -f "$image_file" ]; then
            print_info "加载镜像: $image_file"
            gunzip -c "$image_file" | docker load
        fi
    done

    print_success "所有镜像加载完成"
    docker images
}

# 部署项目
deploy_project() {
    print_info "开始部署项目..."

    # 创建部署目录
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown -R $(whoami) "$DEPLOY_DIR"

    # 解压代码
    print_info "解压项目代码..."
    tar -xzf "$SCRIPT_DIR/code/edu-evaluation.tar.gz" -C "$DEPLOY_DIR"

    # 复制配置文件
    print_info "复制配置文件..."
    cp "$SCRIPT_DIR/config/docker-compose.prod.yml" "$DEPLOY_DIR/deploy/"
    cp "$SCRIPT_DIR/config/.env.production" "$DEPLOY_DIR/deploy/.env"
    cp -r "$SCRIPT_DIR/config/nginx" "$DEPLOY_DIR/deploy/"
    cp -r "$SCRIPT_DIR/config/mysql" "$DEPLOY_DIR/deploy/"

    # 复制 Dockerfile
    cp "$SCRIPT_DIR/config/backend/Dockerfile" "$DEPLOY_DIR/backend/"
    cp "$SCRIPT_DIR/config/ai-worker/Dockerfile" "$DEPLOY_DIR/ai-worker/"

    # 提示用户修改配置
    print_warn "请编辑配置文件修改密码和 API Key:"
    print_info "  vim $DEPLOY_DIR/deploy/.env"

    # 构建并启动服务
    print_info "构建并启动服务..."
    cd "$DEPLOY_DIR/deploy"
    $COMPOSE_CMD -f docker-compose.prod.yml up -d --build

    print_success "部署完成！"
    print_info "查看服务状态: cd $DEPLOY_DIR/deploy && $COMPOSE_CMD ps"
    print_info "查看日志: cd $DEPLOY_DIR/deploy && $COMPOSE_CMD logs -f"
}

# 显示帮助
show_help() {
    echo "教育评估系统 — 离线部署脚本"
    echo ""
    echo "用法: bash deploy-offline.sh [命令]"
    echo ""
    echo "命令:"
    echo "  --load      加载 Docker 镜像"
    echo "  --deploy    部署项目（需先加载镜像）"
    echo "  --all       加载镜像并部署"
    echo "  --help      显示帮助"
}

# 主流程
main() {
    check_docker

    case "${1:---help}" in
        --load)
            load_images
            ;;
        --deploy)
            deploy_project
            ;;
        --all)
            load_images
            deploy_project
            ;;
        --help|*)
            show_help
            ;;
    esac
}

main "$@"
DEPLOY_SCRIPT

    chmod +x "$OUTPUT_DIR/${PACKAGE_NAME}/deploy-offline.sh"
    print_success "离线部署脚本生成完成"
}

# 生成 README
generate_readme() {
    cat > "$OUTPUT_DIR/${PACKAGE_NAME}/README.md" <<'EOF'
# 教育评估系统 — 离线部署包

## 使用说明

### 1. 上传到服务器

```bash
# 将整个离线包上传到目标服务器
scp -r edu-evaluation-offline-* user@server:/opt/
```

### 2. 加载 Docker 镜像

```bash
cd /opt/edu-evaluation-offline-*
bash deploy-offline.sh --load
```

### 3. 部署项目

```bash
# 一键部署（加载镜像 + 部署）
bash deploy-offline.sh --all

# 或分步执行
bash deploy-offline.sh --load    # 先加载镜像
bash deploy-offline.sh --deploy  # 再部署
```

### 4. 修改配置

部署前请编辑配置文件：

```bash
vim /opt/edu-evaluation/deploy/.env
```

需要修改的配置项：
- `MYSQL_PASSWORD` — MySQL 密码
- `MYSQL_ROOT_PASSWORD` — MySQL root 密码
- `RABBITMQ_PASSWORD` — RabbitMQ 密码
- `MINIO_ROOT_PASSWORD` — MinIO 密码
- `MODEL_API_KEY` — AI 模型 API Key

### 5. 验证部署

```bash
cd /opt/edu-evaluation/deploy
docker compose ps          # 查看服务状态
docker compose logs -f     # 查看日志
```

## 包内容说明

```
edu-evaluation-offline-*/
├── images/              # Docker 镜像（tar.gz）
├── code/                # 项目代码
├── config/              # 配置文件
├── deploy-offline.sh    # 部署脚本
└── README.md            # 本文件
```

## 常见问题

### 端口冲突

如果端口被占用，修改 `docker-compose.prod.yml` 中的端口映射。

### 磁盘空间不足

```bash
docker system prune -a  # 清理未使用的镜像和容器
```

### 查看日志

```bash
cd /opt/edu-evaluation/deploy
docker compose logs -f backend     # 后端日志
docker compose logs -f ai-worker   # AI Worker 日志
```
EOF
}

# 显示包信息
show_package_info() {
    print_success "离线包打包完成！"
    echo ""
    print_info "包位置: $OUTPUT_DIR/${PACKAGE_NAME}"
    print_info "包大小: $(du -sh "$OUTPUT_DIR/${PACKAGE_NAME}" | cut -f1)"
    echo ""
    print_info "包内容:"
    ls -lh "$OUTPUT_DIR/${PACKAGE_NAME}/"
    echo ""
    print_info "下一步:"
    print_info "  1. 将 $OUTPUT_DIR/${PACKAGE_NAME} 上传到目标服务器"
    print_info "  2. 在服务器上运行: bash deploy-offline.sh --all"
}

# 显示帮助
show_help() {
    echo "教育评估系统 — 离线打包脚本"
    echo ""
    echo "用法: bash offline-package.sh [命令]"
    echo ""
    echo "命令:"
    echo "  --images    仅打包 Docker 镜像"
    echo "  --code      仅打包项目代码"
    echo "  --all       打包所有内容（默认）"
    echo "  --help      显示帮助"
}

# 主流程
main() {
    check_deps

    case "${1:---all}" in
        --images)
            prepare_output
            package_images
            show_package_info
            ;;
        --code)
            prepare_output
            package_code
            package_config
            generate_deploy_script
            generate_readme
            show_package_info
            ;;
        --all)
            prepare_output
            package_images
            package_code
            package_config
            generate_deploy_script
            generate_readme
            show_package_info
            ;;
        --help|*)
            show_help
            ;;
    esac
}

main "$@"
