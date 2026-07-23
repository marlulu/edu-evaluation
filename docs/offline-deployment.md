# 教育评估系统 — 离线部署指南

本文档适用于在**无外网环境**（内网服务器、离线机房等）部署教育评估系统。

> ⚠️ **重要提示**：本文档明确区分了**本地操作**（有网络的机器）和**服务器操作**（无网络的目标机器），请按标注执行。

---

## 目录

- [1. 环境要求](#1-环境要求)
- [2. 本地操作 — 打包阶段（有网络）](#2-本地操作--打包阶段有网络)
- [3. 传输离线包到服务器](#3-传输离线包到服务器)
- [4. 服务器操作 — 部署阶段（无网络）](#4-服务器操作--部署阶段无网络)
- [5. 验证部署](#5-验证部署)
- [6. 常见问题](#6-常见问题)
- [7. 维护命令](#7-维护命令)
- [8. 单服务更新](#8-单服务更新)

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
| 操作系统 | Ubuntu 20.04+ / CentOS 7+ / Debian 11+ | 推荐 Ubuntu 22.04 LTS |
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | 2.0+ | 容器编排 |

### 1.3 检查环境

```bash
docker --version
docker compose version
df -h
free -h
```

---

## 2. 本地操作 — 打包阶段（有网络）

> 📍 **执行位置**：有网络的开发机/打包机

### 2.1 拉取代码

```bash
git clone <your-repo-url> edu-evaluation
cd edu-evaluation
```

### 2.2 构建应用镜像

```bash
cd deploy
docker compose -f docker-compose.prod.yml build
```

构建完成后，会生成以下镜像：
- `edu-backend:latest`
- `edu-ai-worker:latest`
- `edu-frontend:latest`

### 2.3 拉取基础镜像

```bash
docker pull mysql:8.4
docker pull redis:7-alpine
docker pull minio/minio:latest
```

### 2.4 验证所有镜像

```bash
docker images | grep -E "mysql|redis|minio|edu-"
```

预期输出：
```
mysql              8.4         xxx   x weeks ago   813MB
redis              7-alpine    xxx   x months ago  39.1MB
minio/minio        latest      xxx   x months ago  175MB
edu-backend        latest      xxx   x minutes ago 910MB
edu-ai-worker      latest      xxx   x minutes ago 2.69GB
edu-frontend       latest      xxx   x minutes ago 26.1MB
```

### 2.5 导出所有镜像

**🐧 Linux / macOS：**
```bash
mkdir -p docker-images

# 导出基础镜像
docker save mysql:8.4 | gzip > docker-images/mysql-8.4.tar.gz
docker save redis:7-alpine | gzip > docker-images/redis-7-alpine.tar.gz
docker save minio/minio:latest | gzip > docker-images/minio-latest.tar.gz

# 导出应用镜像
docker save edu-backend:latest | gzip > docker-images/edu-backend.tar.gz
docker save edu-ai-worker:latest | gzip > docker-images/edu-ai-worker.tar.gz
docker save edu-frontend:latest | gzip > docker-images/edu-frontend.tar.gz
```

**🪟 Windows PowerShell：**
```powershell
New-Item -ItemType Directory -Force -Path docker-images

# 导出基础镜像
docker save mysql:8.4 -o docker-images/mysql-8.4.tar
docker save redis:7-alpine -o docker-images/redis-7-alpine.tar
docker save minio/minio:latest -o docker-images/minio-latest.tar

# 导出应用镜像
docker save edu-backend:latest -o docker-images/edu-backend.tar
docker save edu-ai-worker:latest -o docker-images/edu-ai-worker.tar
docker save edu-frontend:latest -o docker-images/edu-frontend.tar
```

### 2.6 打包完整离线包

只需打包 **Docker 镜像 + 部署配置文件**，不需要完整源码。

**🐧 Linux / macOS：**
```bash
cd ..

# 创建离线包目录
mkdir -p edu-evaluation-offline/docker-images
mkdir -p edu-evaluation-offline/deploy

# 复制镜像文件
cp deploy/docker-images/*.tar.gz edu-evaluation-offline/docker-images/

# 复制部署配置文件
cp deploy/docker-compose.prod.yml edu-evaluation-offline/deploy/
cp deploy/.env edu-evaluation-offline/deploy/
cp -r deploy/nginx edu-evaluation-offline/deploy/
cp -r deploy/mysql edu-evaluation-offline/deploy/
cp -r deploy/scripts edu-evaluation-offline/deploy/

# 打包最终离线包
tar czf edu-evaluation-offline-$(date +%Y%m%d).tar.gz edu-evaluation-offline/
```

**🪟 Windows PowerShell：**
```powershell
cd ..

# 创建离线包目录
New-Item -ItemType Directory -Force -Path edu-evaluation-offline\docker-images
New-Item -ItemType Directory -Force -Path edu-evaluation-offline\deploy

# 复制镜像文件
Copy-Item deploy\docker-images\*.tar edu-evaluation-offline\docker-images\

# 复制部署配置文件
Copy-Item deploy\docker-compose.prod.yml edu-evaluation-offline\deploy\
Copy-Item deploy\.env edu-evaluation-offline\deploy\
Copy-Item -Recurse deploy\nginx edu-evaluation-offline\deploy\
Copy-Item -Recurse deploy\mysql edu-evaluation-offline\deploy\
Copy-Item -Recurse deploy\scripts edu-evaluation-offline\deploy\

# 打包最终离线包
$date = Get-Date -Format 'yyyyMMdd'
tar -czf "edu-evaluation-offline-$date.tar.gz" edu-evaluation-offline
```

---

## 3. 传输离线包到服务器

> 📍 **执行位置**：本地机器 → 服务器

**🐧 Linux / macOS：**
```bash
# 方式 1: SCP（推荐）
scp edu-evaluation-offline-*.tar.gz root@server-ip:/opt/

# 方式 2: rsync（支持断点续传）
rsync -avz --progress edu-evaluation-offline-*.tar.gz root@server-ip:/opt/

# 方式 3: USB/移动硬盘
cp edu-evaluation-offline-*.tar.gz /media/usb/
```

**🪟 Windows PowerShell：**
```powershell
# 方式 1: SCP（推荐）
scp edu-evaluation-offline-*.tar.gz root@server-ip:/opt/

# 方式 2: USB/移动硬盘
Copy-Item edu-evaluation-offline-*.tar.gz E:\
```

---

## 4. 服务器操作 — 部署阶段（无网络）

> 📍 **执行位置**：目标服务器（无外网）

### 4.1 安装 Docker（如未安装）

**Ubuntu/Debian：**
```bash
# 如果有离线 Docker 安装包
tar xzf docker-offline-install.tar.gz
cd docker-offline
sudo dpkg -i containerd.io_*.deb docker-ce_*.deb \
  docker-ce-cli_*.deb docker-compose-plugin_*.deb

sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# 重新登录生效
```

**CentOS/RHEL：**
```bash
tar xzf docker-offline-install.tar.gz
cd docker-offline
sudo rpm -ivh containerd.io-*.rpm docker-ce-*.rpm \
  docker-ce-cli-*.rpm docker-compose-plugin-*.rpm

sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

### 4.2 解压离线包

```bash
cd /opt
tar xzf edu-evaluation-offline-*.tar.gz
cd edu-evaluation-offline
```

### 4.3 加载 Docker 镜像

```bash
# 加载所有镜像
for image in docker-images/*.tar.gz; do
  echo "Loading $image..."
  gunzip -c "$image" | docker load
done

# 验证镜像已加载
docker images | grep -E "mysql|redis|minio|edu-"
```

预期输出：
```
mysql              8.4         xxx   x weeks ago   813MB
redis              7-alpine    xxx   x months ago  39.1MB
minio/minio        latest      xxx   x months ago  175MB
edu-backend        latest      xxx   x minutes ago 910MB
edu-ai-worker      latest      xxx   x minutes ago 2.69GB
edu-frontend       latest      xxx   x minutes ago 26.1MB
```

### 4.4 配置环境变量

```bash
cd deploy
```

编辑 `.env` 文件，修改以下关键配置：

```bash
# ===== 必须修改 =====
MYSQL_PASSWORD=YourStrongPassword123!
MYSQL_ROOT_PASSWORD=YourRootPassword456!
MINIO_ROOT_PASSWORD=YourMinioPassword789!

# ===== AI 模型配置 =====
# 如果内网有 AI 模型服务
MODEL_API_BASE_URL=http://your-ai-server:8000/v1
MODEL_API_KEY=your-api-key

# 如果使用 Ollama 本地部署的模型
# MODEL_API_BASE_URL=http://ollama-server:11434/v1
# MODEL_API_KEY=ollama

# ===== 可选（有默认值） =====
MYSQL_DATABASE=edu_evaluation
MYSQL_USER=edu
MINIO_ROOT_USER=minio
MINIO_BUCKET=coursework-submissions
MODEL_PROVIDER_DRIVER=openai-compatible
MODEL_TIMEOUT_SECONDS=180

# ===== 可选（按需配置模型） =====
TEXT_MODEL_NAME=gpt-4o
VISION_MODEL_NAME=gpt-4o
MULTIMODAL_MODEL_NAME=gpt-4o
```

### 4.5 启动服务

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 4.6 查看启动状态

```bash
docker compose -f docker-compose.prod.yml ps
```

等待所有服务状态变为 `healthy`，约需 2-5 分钟。

```bash
# 实时查看日志
docker compose -f docker-compose.prod.yml logs -f --tail=50
```

### 4.7 默认登录账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | 系统管理员 |
| `teacher01` | `teacher123` | 课程教师 |
| `assistant01` | `assistant123` | 教师助理 |
| `student01` | `student123` | 学生 |

---

## 5. 验证部署

### 5.1 检查服务状态

```bash
docker compose -f docker-compose.prod.yml ps
```

预期输出（所有服务应为 healthy）：
```
NAME            IMAGE                   STATUS
edu-ai-worker   edu-ai-worker:latest    Up (healthy)
edu-backend     edu-backend:latest      Up (healthy)
edu-nginx       edu-frontend:latest     Up (healthy)
edu-minio       minio/minio:latest      Up (healthy)
edu-mysql       mysql:8.4               Up (healthy)
edu-redis       redis:7-alpine          Up (healthy)
```

### 5.2 健康检查

```bash
# 前端页面
curl -s -o /dev/null -w "%{http_code}" http://localhost
# 期望: 200

# 后端健康检查
curl -s http://localhost/api/actuator/health
# 期望: {"status":"UP"}

# AI Worker 健康检查
docker exec edu-ai-worker curl -s http://localhost:8000/health
# 期望: {"status":"ok",...}
```

### 5.3 访问系统

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端页面 | `http://服务器IP` | 主应用入口 |
| MinIO 控制台 | `http://服务器IP:19001` | 文件存储管理（默认账号 `minio` / `minio_password`） |

---

## 6. 常见问题

### 6.1 Docker 镜像加载失败

**问题**：`no space left on device`

**解决**：
```bash
docker system prune -a
```

### 6.2 容器启动失败

**问题**：容器状态显示 `Restarting`

**解决**：
```bash
docker compose -f docker-compose.prod.yml logs <service_name>

# 按顺序重启
docker compose -f docker-compose.prod.yml restart mysql
sleep 10
docker compose -f docker-compose.prod.yml restart redis minio
sleep 10
docker compose -f docker-compose.prod.yml restart ai-worker backend frontend
```

### 6.3 数据库连接失败

**问题**：`Connection refused` 或 `Access denied`

**解决**：
```bash
docker compose -f docker-compose.prod.yml ps mysql
cat .env | grep MYSQL
docker exec edu-mysql mysql -u edu -p$(grep MYSQL_PASSWORD .env | cut -d= -f2) -e "SELECT 1;"
```

### 6.4 Flyway 迁移失败

**问题**：`Validate failed: Migration checksum mismatch`

**解决**：
```bash
docker exec -it edu-mysql mysql -u root -p edu_evaluation
TRUNCATE TABLE flyway_schema_history;
EXIT;
docker compose -f docker-compose.prod.yml restart backend
```

### 6.5 AI Worker 无法连接模型服务

**解决**：
```bash
cat .env | grep MODEL
docker exec edu-ai-worker curl -s $MODEL_API_BASE_URL/models
docker compose -f docker-compose.prod.yml logs ai-worker
```

### 6.6 端口被占用

**问题**：`Bind for 0.0.0.0:80 failed: port is already allocated`

**解决**：
```bash
# 查看占用端口的进程
lsof -i :80
# 或
netstat -tlnp | grep :80

# 停止占用端口的服务
sudo systemctl stop nginx  # 如果是系统 nginx
sudo systemctl stop apache2  # 如果是 apache
```

### 6.7 RabbitMQ 健康检查报错

**问题**：`Rabbit health check failed - Connection refused`

**原因**：旧版本镜像残留了 RabbitMQ 依赖

**解决**：重新构建后端镜像（参考 [8. 单服务更新](#8-单服务更新)）

### 6.8 后端状态 unhealthy

**解决**：
```bash
# 查看后端日志
docker logs --tail 100 edu-backend

# 手动检查健康
docker exec edu-backend curl -s http://localhost:8080/actuator/health

# 如果是启动慢，增加 start_period
# 编辑 docker-compose.prod.yml 中 backend 的 healthcheck.start_period
```

---

## 7. 维护命令

### 7.1 服务管理

```bash
# 启动服务
docker compose -f docker-compose.prod.yml up -d

# 停止服务
docker compose -f docker-compose.prod.yml down

# 重启服务
docker compose -f docker-compose.prod.yml restart

# 重启单个服务
docker compose -f docker-compose.prod.yml restart backend

# 查看服务状态
docker compose -f docker-compose.prod.yml ps

# 查看服务日志
docker compose -f docker-compose.prod.yml logs -f

# 查看单个服务日志
docker compose -f docker-compose.prod.yml logs -f backend
```

### 7.2 数据备份

```bash
# 备份 MySQL
docker exec edu-mysql mysqldump -u root -p"YourRootPassword" edu_evaluation > backup_$(date +%Y%m%d).sql

# 备份 MinIO 数据
docker cp edu-minio:/data ./minio-backup-$(date +%Y%m%d)

# 备份上传文件
docker cp edu-backend:/app/data/uploads ./uploads-backup-$(date +%Y%m%d)
```

### 7.3 数据恢复

```bash
# 恢复 MySQL
docker exec -i edu-mysql mysql -u root -p"YourRootPassword" edu_evaluation < backup_20260723.sql

# 恢复上传文件
docker cp uploads-backup-20260723/. edu-backend:/app/data/uploads/
```

### 7.4 清理磁盘

```bash
# 清理未使用的镜像
docker image prune -a -f

# 清理未使用的容器和网络
docker system prune -f

# 查看磁盘使用
docker system df
```

---

## 8. 单服务更新

当只修改了某个服务的代码，无需重新打包所有镜像。

### 8.1 更新后端

#### 本地操作 — 构建并打包

```bash
cd edu-evaluation/deploy
docker compose -f docker-compose.prod.yml build --no-cache backend

# 导出镜像
docker save edu-backend:latest | gzip > edu-backend.tar.gz
```

#### 传输到服务器

```bash
scp edu-backend.tar.gz root@server-ip:/opt/edu-evaluation-offline/deploy/
```

#### 服务器操作 — 部署

```bash
cd /opt/edu-evaluation-offline/deploy

# 加载新镜像
gunzip -c edu-backend.tar.gz | docker load

# 重启后端
docker compose -f docker-compose.prod.yml up -d backend

# 验证
docker compose -f docker-compose.prod.yml ps backend
```

### 8.2 更新前端

#### 本地操作 — 构建并打包

```bash
cd edu-evaluation/deploy
docker compose -f docker-compose.prod.yml build --no-cache frontend

# 导出镜像
docker save edu-frontend:latest | gzip > edu-frontend.tar.gz
```

#### 传输到服务器

```bash
scp edu-frontend.tar.gz root@server-ip:/opt/edu-evaluation-offline/deploy/
```

#### 服务器操作 — 部署

```bash
cd /opt/edu-evaluation-offline/deploy

# 加载新镜像
gunzip -c edu-frontend.tar.gz | docker load

# 重启前端
docker compose -f docker-compose.prod.yml up -d frontend

# 验证
docker compose -f docker-compose.prod.yml ps frontend
```

### 8.3 更新 AI Worker

#### 本地操作 — 构建并打包

```bash
cd edu-evaluation/deploy
docker compose -f docker-compose.prod.yml build --no-cache ai-worker

# 导出镜像
docker save edu-ai-worker:latest | gzip > edu-ai-worker.tar.gz
```

#### 传输到服务器

```bash
scp edu-ai-worker.tar.gz root@server-ip:/opt/edu-evaluation-offline/deploy/
```

#### 服务器操作 — 部署

```bash
cd /opt/edu-evaluation-offline/deploy

# 加载新镜像
gunzip -c edu-ai-worker.tar.gz | docker load

# 重启 AI Worker
docker compose -f docker-compose.prod.yml up -d ai-worker

# 验证
docker compose -f docker-compose.prod.yml ps ai-worker
```

---

## 附录

### A. 离线包目录结构

```
edu-evaluation-offline-20260723.tar.gz
└── edu-evaluation-offline/
    ├── docker-images/                  # Docker 镜像文件
    │   ├── mysql-8.4.tar.gz
    │   ├── redis-7-alpine.tar.gz
    │   ├── minio-latest.tar.gz
    │   ├── edu-backend.tar.gz
    │   ├── edu-ai-worker.tar.gz
    │   └── edu-frontend.tar.gz
    └── deploy/                         # 部署配置文件
        ├── docker-compose.prod.yml
        ├── .env
        ├── nginx/
        │   ├── nginx.conf
        │   └── conf.d/
        │       └── default.conf
        ├── mysql/
        │   └── init.sql
        └── scripts/
```

### B. 操作流程总结

```
┌─────────────────────────────────────────────────────────────┐
│                     本地（有网络）                            │
├─────────────────────────────────────────────────────────────┤
│  1. git clone 项目代码                                       │
│  2. docker compose build  构建应用镜像                       │
│  3. docker pull  拉取基础镜像（mysql/redis/minio）            │
│  4. docker save  导出所有镜像为 tar.gz                       │
│  5. 复制镜像 + 配置文件 = 离线包                             │
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
│  5. 等待所有服务 healthy                                     │
│  6. 访问 http://服务器IP                                     │
└─────────────────────────────────────────────────────────────┘
```

### C. 端口清单

| 服务 | 容器端口 | 宿主机端口 | 对外暴露 | 说明 |
|------|----------|------------|----------|------|
| Nginx (前端) | 80 | 80 | ✅ | Web 应用入口 |
| Backend | 8080 | - | ❌ | 后端 API（内部） |
| AI Worker | 8000 | - | ❌ | AI 分析（内部） |
| MySQL | 3306 | 127.0.0.1:3307 | ❌ | 数据库 |
| Redis | 6379 | 127.0.0.1:6379 | ❌ | 缓存 |
| MinIO API | 9000 | 127.0.0.1:19000 | ❌ | 对象存储 API |
| MinIO Console | 9001 | 127.0.0.1:19001 | 可选 | MinIO 管理界面 |

> 生产环境所有内部服务仅绑定 `127.0.0.1`，仅 Nginx 对外。防火墙只需放行 80。

### D. 故障排查清单

- [ ] Docker 服务是否运行：`systemctl status docker`
- [ ] 磁盘空间是否充足：`df -h`
- [ ] 端口是否被占用：`netstat -tlnp | grep :80`
- [ ] 环境变量是否正确：`cat .env`
- [ ] 所有容器是否健康：`docker compose -f docker-compose.prod.yml ps`
- [ ] 数据库是否可连接：`docker exec edu-mysql mysql -u edu -p -e "SELECT 1"`
- [ ] Flyway 迁移是否成功：`docker compose -f docker-compose.prod.yml logs backend | grep flyway`
- [ ] AI 模型服务是否可达：`docker exec edu-ai-worker curl -s $MODEL_API_BASE_URL/models`

---

> 📝 **文档版本**: v4.0
> 📅 **更新日期**: 2026-07-23
> 👤 **维护者**: 开发团队
