# ============================================================
#  教育评估系统 — 离线打包脚本 (Windows PowerShell)
#  用法: .\offline-package.ps1 [-Images|-Code|-All|-Help]
#  在有网络的机器上运行，生成离线部署包
# ============================================================

param(
    [switch]$Images,
    [switch]$Code,
    [switch]$All,
    [switch]$Help
)

# 颜色函数
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Write-Ok { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 路径配置
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DeployDir = Join-Path $ProjectRoot "deploy"
$OutputDir = Join-Path $ProjectRoot "offline-package"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$PackageName = "edu-evaluation-offline-$Timestamp"

# Docker 镜像列表
$Images = @(
    "mysql:8.4",
    "redis:7-alpine",
    "minio/minio:latest",
    "rabbitmq:4-management",
    "nginx:alpine",
    "eclipse-temurin:17-jre-alpine",
    "python:3.11-slim"
)

# 检查依赖
function Test-Dependencies {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker 未安装"
        exit 1
    }
}

# 创建输出目录
function Initialize-Output {
    Write-Info "准备输出目录..."
    if (Test-Path $OutputDir) {
        Remove-Item -Recurse -Force $OutputDir
    }
    $packageDir = Join-Path $OutputDir $PackageName
    New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $packageDir "images") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $packageDir "code") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $packageDir "config") | Out-Null
}

# 打包 Docker 镜像
function Package-Images {
    Write-Info "开始打包 Docker 镜像..."

    $imagesDir = Join-Path $OutputDir "$PackageName\images"
    Set-Location $imagesDir

    foreach ($image in $Images) {
        Write-Info "拉取镜像: $image"
        docker pull $image

        # 生成安全的文件名
        $filename = ($image -replace '[/:]', '_') + ".tar"
        Write-Info "保存镜像: $image -> $filename"
        docker save -o $filename $image

        # 压缩
        Write-Info "压缩: $filename"
        gzip $filename
    }

    # 生成镜像清单
    @"
# 镜像加载顺序（按依赖关系）
1. mysql:8.4
2. redis:7-alpine
3. minio/minio:latest
4. rabbitmq:4-management
5. eclipse-temurin:17-jre-alpine
6. python:3.11-slim
7. nginx:alpine
"@ | Out-File -FilePath "images.txt" -Encoding UTF8

    Write-Ok "Docker 镜像打包完成"
}

# 打包项目代码
function Package-Code {
    Write-Info "开始打包项目代码..."

    Set-Location $ProjectRoot

    # 使用 tar 打包（Windows 10+ 自带 tar）
    $codeDir = Join-Path $OutputDir "$PackageName\code"
    $tarFile = Join-Path $codeDir "edu-evaluation.tar.gz"

    # 排除不需要的文件
    $excludes = @(
        "--exclude=.git",
        "--exclude=node_modules",
        "--exclude=target",
        "--exclude=__pycache__",
        "--exclude=.env",
        "--exclude=*.log",
        "--exclude=offline-package",
        "--exclude=infra/.venv"
    )

    tar -czf $tarFile $excludes .

    Write-Ok "项目代码打包完成"
}

# 打包配置文件
function Package-Config {
    Write-Info "打包配置文件..."

    $configDir = Join-Path $OutputDir "$PackageName\config"
    Set-Location $configDir

    # 复制部署配置
    Copy-Item (Join-Path $DeployDir "docker-compose.prod.yml") .
    Copy-Item (Join-Path $DeployDir ".env.example") ".env.production"
    if (Test-Path (Join-Path $DeployDir ".env.production")) {
        Copy-Item (Join-Path $DeployDir ".env.production") .
    }
    Copy-Item -Recurse (Join-Path $DeployDir "nginx") .
    Copy-Item -Recurse (Join-Path $DeployDir "mysql") .
    Copy-Item -Recurse (Join-Path $DeployDir "scripts") .

    # 复制 Dockerfile（用于离线构建）
    New-Item -ItemType Directory -Force -Path "backend" | Out-Null
    New-Item -ItemType Directory -Force -Path "ai-worker" | Out-Null
    New-Item -ItemType Directory -Force -Path "frontend" | Out-Null

    Copy-Item (Join-Path $ProjectRoot "backend\Dockerfile") "backend\"
    Copy-Item (Join-Path $ProjectRoot "ai-worker\Dockerfile") "ai-worker\"
    if (Test-Path (Join-Path $ProjectRoot "frontend\Dockerfile")) {
        Copy-Item (Join-Path $ProjectRoot "frontend\Dockerfile") "frontend\"
    }

    Write-Ok "配置文件打包完成"
}

# 生成部署脚本
function Generate-DeployScript {
    Write-Info "生成离线部署脚本..."

    $deployScript = @'
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
'@

    $scriptPath = Join-Path $OutputDir "$PackageName\deploy-offline.sh"
    $deployScript | Out-File -FilePath $scriptPath -Encoding UTF8

    Write-Ok "离线部署脚本生成完成"
}

# 生成 README
function Generate-Readme {
    $readme = @'
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
'@

    $readmePath = Join-Path $OutputDir "$PackageName\README.md"
    $readme | Out-File -FilePath $readmePath -Encoding UTF8
}

# 显示包信息
function Show-PackageInfo {
    Write-Ok "离线包打包完成！"
    Write-Host ""
    Write-Info "包位置: $OutputDir\$PackageName"

    $packageDir = Join-Path $OutputDir $PackageName
    $size = (Get-ChildItem -Recurse $packageDir | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Info "包大小: $([math]::Round($size, 2)) MB"

    Write-Host ""
    Write-Info "包内容:"
    Get-ChildItem $packageDir | Format-Table Name, @{N='Size';E={if($_.PSIsContainer){''}else{'{0:N2} MB' -f ($_.Length/1MB)}}}

    Write-Host ""
    Write-Info "下一步:"
    Write-Info "  1. 将 $OutputDir\$PackageName 上传到目标服务器"
    Write-Info "  2. 在服务器上运行: bash deploy-offline.sh --all"
}

# 显示帮助
function Show-Help {
    Write-Host "教育评估系统 — 离线打包脚本"
    Write-Host ""
    Write-Host "用法: .\offline-package.ps1 [参数]"
    Write-Host ""
    Write-Host "参数:"
    Write-Host "  -Images    仅打包 Docker 镜像"
    Write-Host "  -Code      仅打包项目代码"
    Write-Host "  -All       打包所有内容（默认）"
    Write-Host "  -Help      显示帮助"
}

# 主流程
function Main {
    Test-Dependencies

    if ($Help) {
        Show-Help
        return
    }

    if ($Images) {
        Initialize-Output
        Package-Images
        Show-PackageInfo
        return
    }

    if ($Code) {
        Initialize-Output
        Package-Code
        Package-Config
        Generate-DeployScript
        Generate-Readme
        Show-PackageInfo
        return
    }

    # 默认：打包所有
    Initialize-Output
    Package-Images
    Package-Code
    Package-Config
    Generate-DeployScript
    Generate-Readme
    Show-PackageInfo
}

Main
