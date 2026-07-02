#!/bin/bash
# ============================================================
#  教育评估系统 — 一键部署脚本
#  用法: bash deploy.sh [--build|--restart|--stop|--logs|--status]
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 项目路径
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$PROJECT_ROOT/deploy"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env"

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
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose 未安装"
        exit 1
    fi
}

# 检查环境变量文件
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warn ".env 文件不存在，正在从模板创建..."
        cp "$DEPLOY_DIR/.env.production" "$ENV_FILE"
        print_warn "请编辑 $ENV_FILE 修改密码和 API Key"
        exit 1
    fi
}

# 构建前端
build_frontend() {
    print_info "构建前端..."
    cd "$PROJECT_ROOT/frontend"

    if [ ! -d "node_modules" ]; then
        print_info "安装前端依赖..."
        npm ci
    fi

    npm run build
    print_success "前端构建完成"
}

# 构建并启动服务
deploy() {
    print_info "开始部署..."
    cd "$DEPLOY_DIR"

    # 构建镜像
    print_info "构建 Docker 镜像..."
    docker compose -f "$COMPOSE_FILE" build

    # 启动服务
    print_info "启动服务..."
    docker compose -f "$COMPOSE_FILE" up -d

    # 等待服务就绪
    print_info "等待服务就绪..."
    sleep 10

    # 检查状态
    show_status
    print_success "部署完成！"
}

# 重启服务
restart() {
    print_info "重启服务..."
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" restart
    print_success "重启完成"
}

# 停止服务
stop() {
    print_info "停止服务..."
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" down
    print_success "服务已停止"
}

# 显示状态
show_status() {
    print_info "服务状态："
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" ps
}

# 显示日志
show_logs() {
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
}

# 备份数据
backup() {
    print_info "开始备份..."
    BACKUP_DIR="$DEPLOY_DIR/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # 备份 MySQL
    print_info "备份 MySQL..."
    docker exec edu-mysql mysqldump -u root -p"$(grep MYSQL_ROOT_PASSWORD $ENV_FILE | cut -d= -f2)" \
        "$(grep MYSQL_DATABASE $ENV_FILE | cut -d= -f2)" > "$BACKUP_DIR/mysql.sql"

    # 备份上传文件
    print_info "备份上传文件..."
    docker cp edu-backend:/app/data/uploads "$BACKUP_DIR/uploads" 2>/dev/null || true

    print_success "备份完成: $BACKUP_DIR"
}

# 显示帮助
show_help() {
    echo "教育评估系统 — 部署脚本"
    echo ""
    echo "用法: bash deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  --build     构建前端并部署"
    echo "  --deploy    仅部署（不构建前端）"
    echo "  --restart   重启服务"
    echo "  --stop      停止服务"
    echo "  --status    查看状态"
    echo "  --logs      查看日志"
    echo "  --backup    备份数据"
    echo "  --help      显示帮助"
}

# 主流程
main() {
    check_deps
    check_env

    case "${1:---help}" in
        --build)
            build_frontend
            deploy
            ;;
        --deploy)
            deploy
            ;;
        --restart)
            restart
            ;;
        --stop)
            stop
            ;;
        --status)
            show_status
            ;;
        --logs)
            show_logs
            ;;
        --backup)
            backup
            ;;
        --help|*)
            show_help
            ;;
    esac
}

main "$@"
