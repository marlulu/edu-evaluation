# 一键部署指南

> 5 分钟完成从零到运行的全栈部署。

---

## 前置条件

| 依赖 | 最低版本 | 检查命令 |
|------|----------|----------|
| Docker | 24.0+ | `docker --version` |
| Docker Compose | 2.20+ | `docker compose version` |
| Git | 任意 | `git --version` |

```bash
# Ubuntu 一键安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录终端生效
```

---

## 在线部署（3 步完成）

### 第 1 步：拉取代码

```bash
cd /opt
git clone <your-repo-url> edu-evaluation
cd edu-evaluation
```

### 第 2 步：配置环境变量

```bash
cd deploy
cp .env.production .env
vim .env   # 必须修改密码和 API Key
```

**`.env` 最小配置示例：**

```bash
# ===== 必须修改 =====
MYSQL_PASSWORD=YourStrongPassword123!
MYSQL_ROOT_PASSWORD=YourRootPassword456!
MINIO_ROOT_PASSWORD=YourMinioPassword789!
MODEL_API_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=sk-your-actual-api-key

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

### 第 3 步：一键启动

```bash
# 方式一：使用部署脚本（推荐）
bash scripts/deploy.sh --build

# 方式二：直接用 Docker Compose
docker compose -f docker-compose.prod.yml up -d --build
```

首次构建约 5-10 分钟（取决于网络和机器性能）。

---

## 验证部署

```bash
# 查看所有服务状态（应全部显示 healthy）
docker compose -f docker-compose.prod.yml ps

# 后端健康检查
curl -s http://localhost/api/actuator/health
# 期望: {"status":"UP"}

# 前端页面
curl -s -o /dev/null -w "%{http_code}" http://localhost
# 期望: 200

# AI Worker 健康检查
docker exec edu-ai-worker curl -s http://localhost:8000/health
# 期望: {"status":"ok",...}
```

**访问地址：**
- 前端界面：`http://marwind.top`
- MinIO 控制台：`http://<服务器IP>:19001`（默认账号 `minio` / `minio_password`）

**默认登录账号：**
- 管理员：`admin` / `admin123`
- 教师：`teacher01` / `teacher123`

---

## 离线部署（无外网环境）

### 在有网机器上打包

```bash
# Linux / macOS
bash scripts/offline-package.sh

# Windows PowerShell
.\scripts\offline-package.ps1
```

生成 `edu-evaluation-offline.tar.gz`，包含所有 Docker 镜像和部署文件。

### 在目标机器上部署

```bash
# 传输到目标机器后解压
tar xzf edu-evaluation-offline.tar.gz
cd edu-evaluation-offline

# 编辑配置
vim .env

# 一键部署
bash deploy-offline.sh
```

---

## 服务管理

```bash
cd /opt/edu-evaluation/deploy

# 查看状态
docker compose -f docker-compose.prod.yml ps

# 查看日志（所有服务）
docker compose -f docker-compose.prod.yml logs -f --tail=50

# 查看单个服务日志
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f ai-worker

# 重启所有服务
docker compose -f docker-compose.prod.yml restart

# 重启单个服务
docker compose -f docker-compose.prod.yml restart backend

# 停止所有服务
docker compose -f docker-compose.prod.yml down

# 停止并清除数据（危险！）
docker compose -f docker-compose.prod.yml down -v
```

或使用脚本：

```bash
bash scripts/deploy.sh --status    # 查看状态
bash scripts/deploy.sh --restart   # 重启
bash scripts/deploy.sh --stop      # 停止
bash scripts/deploy.sh --logs      # 日志
bash scripts/deploy.sh --backup    # 备份
```

---

## 单服务更新

当只修改了某个服务的代码，无需全量重建：

```bash
# 更新后端
bash scripts/update-backend.sh

# 更新前端
bash scripts/update-frontend.sh

# 更新 AI Worker
bash scripts/update-ai-worker.sh
```

---

## 数据备份与恢复

```bash
# 备份
bash scripts/deploy.sh --backup
# 备份文件在 deploy/backups/<timestamp>/

# 手动恢复 MySQL
docker exec -i edu-mysql mysql -u root -p"<root_password>" edu_evaluation < backup/mysql.sql

# 手动恢复上传文件
docker cp backup/uploads edu-backend:/app/data/
```

---

## 常见问题

### 服务启动失败

```bash
# 查看具体错误
docker compose -f docker-compose.prod.yml logs <service_name>

# 常见原因：端口被占用
sudo lsof -i :80
sudo lsof -i :3306
sudo lsof -i :9000
```

### MinIO 连接失败（Connection refused）

检查 MinIO 端口是否与配置一致：
```bash
# 确认 MinIO 实际端口
docker port edu-minio

# 确认 .env 中的 MINIO 配置
grep MINIO .env
```

### 后端连不上 MySQL

```bash
# 等待 MySQL 就绪
docker compose -f docker-compose.prod.yml logs mysql | grep "ready for connections"

# 检查数据库是否初始化
docker exec -it edu-mysql mysql -u edu -p edu_evaluation -e "SHOW TABLES;"
```

### AI Worker 报错 "MinIO is not configured"

AI Worker 的 MinIO 配置通过 Docker Compose 环境变量传入，检查 `docker-compose.prod.yml` 中 `ai-worker` 服务的 `MINIO_ENDPOINT` 是否指向 `http://minio:9000`。

### 前端显示 502 Bad Gateway

后端尚未启动完成：
```bash
docker compose -f docker-compose.prod.yml ps backend
docker compose -f docker-compose.prod.yml logs backend
```

### Docker 构建很慢（国内网络）

```bash
# 配置镜像加速
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF
sudo systemctl restart docker
```

---

## 端口参考

| 服务 | 容器内端口 | 宿主机端口 | 对外暴露 |
|------|-----------|-----------|----------|
| Nginx (前端) | 80 | 80 | ✅ |
| Backend | 8080 | - | ❌ |
| AI Worker | 8000 | - | ❌ |
| MySQL | 3306 | 127.0.0.1:3307 | ❌ |
| Redis | 6379 | 127.0.0.1:6379 | ❌ |
| MinIO API | 9000 | 127.0.0.1:19000 | ❌ |
| MinIO Console | 9001 | 127.0.0.1:19001 | 可选 |

> 生产环境所有内部服务仅绑定 `127.0.0.1`，仅 Nginx 对外。防火墙只需放行 80。
