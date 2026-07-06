# 教育评估系统 — 离线部署指南

本文档适用于在**无外网环境**（内网服务器、离线机房等）部署教育评估系统。

> ⚠️ **重要提示**：本文档明确区分了**本地操作**（有网络的机器）和**服务器操作**（无网络的目标机器），请按标注执行。

---

## 目录

- [1. 环境要求](#1-环境要求)
- [2. 本地操作 — 打包阶段（有网络）](#2-本地操作--打包阶段有网络)
- [3. 传输离线包到服务器](#3-传输离线包到服务器)
- [4. 服务器操作 — 部署阶段（无网络）](#4-服务器操作--部署阶段无网络)
- [5. 配置与启动](#5-配置与启动)
- [6. 验证部署](#6-验证部署)
- [7. 数据库迁移（Flyway）](#7-数据库迁移flyway)
- [8. 常见问题](#8-常见问题)
- [9. 维护命令](#9-维护命令)

---

## 1. 环境要求

### 1.1 硬件要求

| 资源 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 20 GB | 50 GB+（含数据存储） |

### 1.2 软件要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| 操作系统 | Ubuntu 20.04+ / CentOS 7+ / Debian 11+ / Windows 10+ | 推荐 Ubuntu 22.04 LTS |
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | 2.0+ | 容器编排 |

### 1.3 检查环境

**🐧 Linux / macOS：**
```bash
docker --version
docker compose version
df -h
free -h
```

**🪟 Windows PowerShell：**
```powershell
docker --version
docker compose version
Get-PSDrive -Name C | Select-Object Used, Free
Get-ComputerInfo | Select-Object CsTotalPhysicalMemory
```

---

## 2. 本地操作 — 打包阶段（有网络）

> 📍 **执行位置**：有网络的开发机/打包机

### 2.1 拉取基础镜像

只需拉取**运行时**基础镜像，构建工具镜像（maven、node、python）不需要。

**🐧 Linux / macOS：**
```bash
# 创建镜像列表
cat > images.txt << 'EOF'
mysql:8.4
redis:7-alpine
minio/minio:latest
rabbitmq:4-management
nginx:alpine
EOF

# 拉取所有镜像
while read image; do
  echo "Pulling $image..."
  docker pull "$image"
done < images.txt
```

**🪟 Windows PowerShell：**
```powershell
# 拉取所有镜像
$images = @(
    "mysql:8.4",
    "redis:7-alpine",
    "minio/minio:latest",
    "rabbitmq:4-management",
    "nginx:alpine"
)

foreach ($image in $images) {
    Write-Host "Pulling $image..."
    docker pull $image
}
```

### 2.2 构建应用镜像

**🐧 Linux / macOS / 🪟 Windows（通用）：**
```bash
cd edu-evaluation/deploy
docker compose build
```

### 2.3 导出所有镜像

**🐧 Linux / macOS：**
```bash
mkdir -p docker-images

# 导出基础镜像
docker save mysql:8.4 | gzip > docker-images/mysql-8.4.tar.gz
docker save redis:7-alpine | gzip > docker-images/redis-7-alpine.tar.gz
docker save minio/minio:latest | gzip > docker-images/minio-latest.tar.gz
docker save rabbitmq:4-management | gzip > docker-images/rabbitmq-4-management.tar.gz
docker save nginx:alpine | gzip > docker-images/nginx-alpine.tar.gz

# 导出应用镜像
docker save deploy-backend | gzip > docker-images/edu-backend.tar.gz
docker save deploy-ai-worker | gzip > docker-images/edu-ai-worker.tar.gz
docker save deploy-frontend | gzip > docker-images/edu-frontend.tar.gz
```

**🪟 Windows PowerShell：**
```powershell
New-Item -ItemType Directory -Force -Path docker-images

# 导出基础镜像
docker save mysql:8.4 -o docker-images/mysql-8.4.tar
docker save redis:7-alpine -o docker-images/redis-7-alpine.tar
docker save minio/minio:latest -o docker-images/minio-latest.tar
docker save rabbitmq:4-management -o docker-images/rabbitmq-4-management.tar
docker save nginx:alpine -o docker-images/nginx-alpine.tar

# 导出应用镜像
docker save deploy-backend -o docker-images/edu-backend.tar
docker save deploy-ai-worker -o docker-images/edu-ai-worker.tar
docker save deploy-frontend -o docker-images/edu-frontend.tar
```

### 2.4 打包完整离线包

只需打包 **Docker 镜像 + 部署配置文件**，不需要完整源码。

**🐧 Linux / macOS：**
```bash
# 回到项目根目录
cd ..

# 创建离线包目录
mkdir -p edu-evaluation-offline/docker-images

# 复制镜像文件
cp deploy/docker-images/*.tar.gz edu-evaluation-offline/docker-images/

# 复制部署配置文件
cp -r deploy/ edu-evaluation-offline/deploy/

# 打包最终离线包
tar czf edu-evaluation-offline-$(date +%Y%m%d).tar.gz edu-evaluation-offline/
```

**🪟 Windows PowerShell：**
```powershell
# 回到项目根目录
cd ..

# 创建离线包目录
New-Item -ItemType Directory -Force -Path edu-evaluation-offline\docker-images

# 复制镜像文件
Copy-Item deploy\docker-images\*.tar edu-evaluation-offline\docker-images\

# 复制部署配置文件
Copy-Item -Recurse deploy edu-evaluation-offline\

# 打包最终离线包
$date = Get-Date -Format 'yyyyMMdd'
tar -czf "edu-evaluation-offline-$date.tar.gz" edu-evaluation-offline
```

> 💡 **为什么不需要源码？**
> - Docker 镜像已包含编译好的应用程序
> - 部署只需要：`docker-compose.yml`、`.env`、`nginx/`、`mysql/` 等配置文件
> - 数据库迁移脚本已打包在 backend 镜像中

---

## 3. 传输离线包到服务器

> 📍 **执行位置**：本地机器 → 服务器

**🐧 Linux / macOS：**
```bash
# 方式 1: SCP（推荐）
scp edu-evaluation-offline-*.tar.gz user@server-ip:/opt/

# 方式 2: rsync（支持断点续传）
rsync -avz --progress edu-evaluation-offline-*.tar.gz user@server-ip:/opt/

# 方式 3: USB/移动硬盘
cp edu-evaluation-offline-*.tar.gz /media/usb/
```

**🪟 Windows PowerShell：**
```powershell
# 方式 1: SCP（推荐）
scp edu-evaluation-offline-*.tar.gz user@server-ip:/opt/

# 方式 2: USB/移动硬盘
Copy-Item edu-evaluation-offline-*.tar.gz E:\
```

---

## 4. 服务器操作 — 部署阶段（无网络）

> 📍 **执行位置**：目标服务器（无外网）

### 4.1 安装 Docker（如未安装）

**🐧 Ubuntu/Debian：**
```bash
tar xzf docker-offline-install.tar.gz
cd docker-offline
sudo dpkg -i containerd.io_*.deb docker-ce_*.deb \
  docker-ce-cli_*.deb docker-compose-plugin_*.deb

sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# 重新登录生效
```

**🐧 CentOS/RHEL：**
```bash
tar xzf docker-offline-install.tar.gz
cd docker-offline
sudo rpm -ivh containerd.io-*.rpm docker-ce-*.rpm \
  docker-ce-cli-*.rpm docker-compose-plugin-*.rpm

sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

**🪟 Windows Server：**
```powershell
# Windows Server 需要预先安装 Docker Desktop 或 Docker Engine
# 参考：https://docs.docker.com/engine/install/windows-server/
```

### 4.2 解压离线包

**🐧 Linux：**
```bash
cd /opt
tar xzf edu-evaluation-offline-*.tar.gz
cd edu-evaluation-offline
```

**🪟 Windows PowerShell：**
```powershell
cd C:\
tar -xzf edu-evaluation-offline-*.tar.gz
cd edu-evaluation-offline
```

### 4.3 加载 Docker 镜像

**🐧 Linux：**
```bash
# 加载所有镜像
for image in docker-images/*.tar.gz; do
  echo "Loading $image..."
  gunzip -c "$image" | docker load
done

# 验证镜像已加载
docker images | grep -E "mysql|redis|minio|rabbitmq|nginx|edu-|deploy-"
```

**🪟 Windows PowerShell：**
```powershell
# 加载所有镜像
Get-ChildItem docker-images/*.tar | ForEach-Object {
    Write-Host "Loading $($_.Name)..."
    docker load -i $_.FullName
}

# 验证镜像已加载
docker images | Select-String -Pattern "mysql|redis|minio|rabbitmq|nginx|edu-|deploy-"
```

### 4.4 创建环境配置文件

**🐧 Linux / 🪟 Windows（通用）：**
```bash
cd deploy
cp .env.example .env
```

编辑 `.env` 文件，修改以下关键配置：

```bash
# ============================================================
#  必须修改的配置
# ============================================================

# MySQL 密码（设置强密码）
MYSQL_PASSWORD=YourStrongPassword123!
MYSQL_ROOT_PASSWORD=YourRootPassword456!

# RabbitMQ 密码
RABBITMQ_PASSWORD=YourRabbitPassword789!

# MinIO 密码
MINIO_ROOT_PASSWORD=YourMinioPassword012!

# ============================================================
#  AI 模型配置（根据内网环境配置）
# ============================================================

# 如果内网有 AI 模型服务
MODEL_API_BASE_URL=http://your-ai-server:8000/v1
MODEL_API_KEY=your-api-key
MODEL_PROVIDER_DRIVER=openai-compatible

# 如果使用 Ollama 本地部署的模型
# MODEL_API_BASE_URL=http://ollama-server:11434/v1
# MODEL_API_KEY=ollama
```

### 4.5 启动服务

**🐧 Linux / 🪟 Windows（通用）：**
```bash
# 启动所有服务
docker compose up -d

# 查看启动状态
docker compose ps

# 查看日志（等待所有服务 healthy）
docker compose logs -f
```

### 4.6 初始化 MinIO Bucket

首次部署需要创建存储桶：

**🐧 Linux / 🪟 Windows（通用）：**
```bash
# 等待 MinIO 启动
sleep 15

# 创建 bucket
docker exec edu-minio mc alias set local http://localhost:9000 \
  $(grep MINIO_ROOT_USER .env | cut -d= -f2) \
  $(grep MINIO_ROOT_PASSWORD .env | cut -d= -f2)

docker exec edu-minio mc mb local/coursework-submissions --ignore-existing
```

---

## 5. 配置与启动

### 5.1 SSL 证书配置（可选）

**🐧 Linux / 🪟 Windows（通用）：**
```bash
# 将证书文件放入 nginx/ssl 目录
cp your-cert.pem nginx/ssl/cert.pem
cp your-key.pem nginx/ssl/key.pem

# 修改 nginx 配置启用 SSL
vi nginx/conf.d/default.conf
```

### 5.2 端口配置

默认端口映射（在 `.env` 中可修改）：

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| Web 应用 | 80 | `APP_PORT=80` |
| MySQL | 3307 | `MYSQL_PORT=3307` |
| Redis | 6379 | `REDIS_PORT=6379` |
| MinIO API | 9000 | `MINIO_API_PORT=9000` |
| MinIO 控制台 | 9001 | `MINIO_CONSOLE_PORT=9001` |
| RabbitMQ | 5672 | `RABBITMQ_PORT=5672` |
| RabbitMQ 管理 | 15672 | `RABBITMQ_MGMT_PORT=15672` |

---

## 6. 验证部署

### 6.1 检查服务状态

**🐧 Linux / 🪟 Windows（通用）：**
```bash
docker compose ps

# 预期输出（所有服务应为 healthy 或 running）：
# NAME            IMAGE                   STATUS
# edu-ai-worker   deploy-ai-worker        Up (healthy)
# edu-backend     deploy-backend          Up (healthy)
# edu-frontend    deploy-frontend         Up
# edu-minio       minio/minio:latest      Up (healthy)
# edu-mysql       mysql:8.4               Up (healthy)
# edu-nginx       nginx:alpine            Up (healthy)
# edu-rabbitmq    rabbitmq:4-management   Up (healthy)
# edu-redis       redis:7-alpine          Up (healthy)
```

### 6.2 健康检查

**🐧 Linux：**
```bash
curl -s http://localhost/
curl -s http://localhost:8080/actuator/health
curl -s http://localhost:8000/health
```

**🪟 Windows PowerShell：**
```powershell
Invoke-WebRequest -Uri http://localhost/ -UseBasicParsing
Invoke-WebRequest -Uri http://localhost:8080/actuator/health -UseBasicParsing
Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing
```

### 6.3 访问系统

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端页面 | `http://服务器IP` | 主应用入口 |
| 后端 API | `http://服务器IP:8080` | REST API |
| MinIO 控制台 | `http://服务器IP:9001` | 文件存储管理 |
| RabbitMQ 管理 | `http://服务器IP:15672` | 消息队列管理 |

---

## 7. 数据库迁移（Flyway）

本项目使用 **Flyway** 管理数据库版本。

### 7.1 工作原理

- 迁移脚本位于 `backend/src/main/resources/db/migration/`
- 命名规则：`V{版本号}__{描述}.sql`（如 `V1__init_schema.sql`）
- 应用启动时自动检测并执行新的迁移脚本
- 迁移记录存储在 `flyway_schema_history` 表中

### 7.2 添加新的数据库变更

在**本地**创建迁移文件，重新打包部署：

```bash
# 本地：创建新的迁移文件
vi backend/src/main/resources/db/migration/V2__add_score_column.sql
```

```sql
-- V2__add_score_column.sql
ALTER TABLE student_works ADD COLUMN score INT DEFAULT 0;
ALTER TABLE student_works ADD COLUMN feedback TEXT;
```

重新打包并部署后，重启后端服务自动执行：

**🐧 Linux / 🪟 Windows（通用）：**
```bash
docker compose restart backend
```

### 7.3 查看迁移状态

**🐧 Linux / 🪟 Windows（通用）：**
```bash
docker exec -it edu-mysql mysql -u edu -p edu_evaluation

# 查看迁移历史
SELECT * FROM flyway_schema_history ORDER BY installed_rank;
```

---

## 8. 常见问题

### 8.1 Docker 镜像加载失败

**问题**：`no space left on device`

**解决**：
```bash
docker system prune -a
```

### 8.2 容器启动失败

**问题**：容器状态显示 `Restarting`

**解决**：
```bash
docker compose logs <service_name>

# 按顺序重启
docker compose restart mysql
sleep 10
docker compose restart redis rabbitmq minio
sleep 10
docker compose restart ai-worker backend nginx
```

### 8.3 数据库连接失败

**问题**：`Connection refused` 或 `Access denied`

**解决**：
```bash
docker compose ps mysql
cat .env | grep MYSQL
docker exec edu-mysql mysql -u edu -p$(grep MYSQL_PASSWORD .env | cut -d= -f2) -e "SELECT 1;"
```

### 8.4 Flyway 迁移失败

**问题**：`Validate failed: Migration checksum mismatch`

**解决**：
```bash
docker exec -it edu-mysql mysql -u root -p edu_evaluation
TRUNCATE TABLE flyway_schema_history;
EXIT;
docker compose restart backend
```

### 8.5 AI Worker 无法连接模型服务

**解决**：
```bash
cat .env | grep MODEL
docker exec edu-ai-worker curl -s $MODEL_API_BASE_URL/models
docker compose logs ai-worker
```

### 8.6 端口被占用

**问题**：`Bind for 0.0.0.0:80 failed: port is already allocated`

**🐧 Linux：**
```bash
lsof -i :80
sudo systemctl stop nginx
```

**🪟 Windows PowerShell：**
```powershell
netstat -ano | findstr :80
# 停止占用端口的进程
```

**通用解决**：修改 `.env` 中的端口
```bash
APP_PORT=8080
```

### 8.7 Maven 构建超时（国内服务器）

在 `backend/Dockerfile` 中已配置阿里云镜像，如未生效：

```bash
RUN mkdir -p ~/.m2 && cat > ~/.m2/settings.xml <<'EOF'
<settings>
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <name>Aliyun Maven Mirror</name>
      <url>https://maven.aliyun.com/repository/public</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>
EOF
```

---

## 9. 维护命令

### 9.1 服务管理

**🐧 Linux / 🪟 Windows（通用）：**
```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 重启单个服务
docker compose restart backend

# 查看服务状态
docker compose ps

# 查看服务日志
docker compose logs -f

# 查看单个服务日志
docker compose logs -f backend
```

### 9.2 数据备份

**🐧 Linux：**
```bash
docker exec edu-mysql mysqldump -u root -p edu_evaluation > backup_$(date +%Y%m%d).sql
docker cp edu-minio:/data ./minio-backup-$(date +%Y%m%d)
docker run --rm -v edu-evaluation_mysql_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/mysql-data-$(date +%Y%m%d).tar.gz /data
```

**🪟 Windows PowerShell：**
```powershell
docker exec edu-mysql mysqldump -u root -p edu_evaluation > backup_$(Get-Date -Format 'yyyyMMdd').sql
docker cp edu-minio:/data ./minio-backup-$(Get-Date -Format 'yyyyMMdd')
```

### 9.3 数据恢复

**🐧 Linux：**
```bash
docker exec -i edu-mysql mysql -u root -p edu_evaluation < backup_20260706.sql
docker run --rm -v edu-evaluation_mysql_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/mysql-data-20260706.tar.gz -C /
```

**🪟 Windows PowerShell：**
```powershell
Get-Content backup_20260706.sql | docker exec -i edu-mysql mysql -u root -p edu_evaluation
```

### 9.4 更新系统

在**本地**重新打包镜像，传输到服务器后：

**🐧 Linux：**
```bash
docker compose down
for image in docker-images/*.tar.gz; do
  gunzip -c "$image" | docker load
done
docker compose up -d
docker image prune -a
```

**🪟 Windows PowerShell：**
```powershell
docker compose down
Get-ChildItem docker-images/*.tar | ForEach-Object {
    Write-Host "Loading $($_.Name)..."
    docker load -i $_.FullName
}
docker compose up -d
docker image prune -a
```

### 9.5 监控命令

**🐧 Linux / 🪟 Windows（通用）：**
```bash
docker stats
docker system df
docker inspect edu-backend
docker exec -it edu-backend sh
docker exec -it edu-ai-worker bash
```

---

## 附录

### A. 离线包目录结构

```
edu-evaluation-offline-20260706.tar.gz
└── edu-evaluation-offline/
    ├── docker-images/                  # Docker 镜像文件
    │   ├── mysql-8.4.tar.gz
    │   ├── redis-7-alpine.tar.gz
    │   ├── minio-latest.tar.gz
    │   ├── rabbitmq-4-management.tar.gz
    │   ├── nginx-alpine.tar.gz
    │   ├── edu-backend.tar.gz
    │   ├── edu-ai-worker.tar.gz
    │   └── edu-frontend.tar.gz
    └── deploy/                         # 部署配置文件
        ├── docker-compose.yml
        ├── .env.example
        ├── mysql/
        └── nginx/
```

### B. 操作流程总结

```
┌─────────────────────────────────────────────────────────────┐
│                     本地（有网络）                            │
├─────────────────────────────────────────────────────────────┤
│  1. git clone 项目代码                                       │
│  2. docker compose build  构建镜像                           │
│  3. docker save  导出所有镜像为 tar                          │
│  4. 复制 deploy/ 配置目录                                    │
│  5. 打包镜像 + 配置 = 离线包                                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ scp / rsync / USB
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    服务器（无网络）                           │
├─────────────────────────────────────────────────────────────┤
│  1. 解压离线包                                               │
│  2. docker load  加载所有镜像                                │
│  3. 编辑 .env  配置密码和 AI 模型地址                        │
│  4. docker compose up -d  启动服务                           │
│  5. 验证所有服务 healthy                                     │
└─────────────────────────────────────────────────────────────┘
```

### C. 端口清单

| 服务 | 容器端口 | 宿主机端口 | 协议 | 说明 |
|------|----------|------------|------|------|
| Nginx | 80 | 80 | HTTP | Web 应用入口 |
| Nginx | 443 | 443 | HTTPS | SSL 加密访问 |
| Backend | 8080 | - | HTTP | 后端 API（内部） |
| AI Worker | 8000 | - | HTTP | AI 分析（内部） |
| MySQL | 3306 | 3307 | TCP | 数据库 |
| Redis | 6379 | 6379 | TCP | 缓存 |
| MinIO API | 9000 | 9000 | HTTP | 对象存储 API |
| MinIO Console | 9001 | 9001 | HTTP | MinIO 管理界面 |
| RabbitMQ | 5672 | 5672 | AMQP | 消息队列 |
| RabbitMQ Mgmt | 15672 | 15672 | HTTP | RabbitMQ 管理界面 |

### D. 故障排查清单

- [ ] Docker 服务是否运行：`systemctl status docker`（Linux）或检查 Docker Desktop（Windows）
- [ ] 磁盘空间是否充足：`df -h`（Linux）或 `Get-PSDrive`（Windows）
- [ ] 端口是否被占用：`netstat -tlnp | grep :80`（Linux）或 `netstat -ano | findstr :80`（Windows）
- [ ] 环境变量是否正确：`cat .env`
- [ ] 所有容器是否健康：`docker compose ps`
- [ ] 数据库是否可连接：`docker exec edu-mysql mysql -u edu -p -e "SELECT 1"`
- [ ] Flyway 迁移是否成功：`docker compose logs backend | grep flyway`
- [ ] AI 模型服务是否可达：`docker exec edu-ai-worker curl -s $MODEL_API_BASE_URL/models`

---

> 📝 **文档版本**: v3.2
> 📅 **更新日期**: 2026-07-06
> 👤 **维护者**: 开发团队
