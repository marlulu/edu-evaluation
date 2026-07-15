# 教育评估系统 — 部署指南

## 目录

- [1. 架构概览](#1-架构概览)
- [2. 环境要求](#2-环境要求)
- [3. 快速部署（Docker Compose）](#3-快速部署docker-compose)
- [4. 手动部署](#4-手动部署)
- [5. 配置说明](#5-配置说明)
- [6. 常见问题](#6-常见问题)
- [7. 运维手册](#7-运维手册)
- [8. 安全建议](#8-安全建议)

---

## 1. 架构概览

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                      Nginx (80)                         │
│                  前端静态文件 + API 代理                   │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌───────────────────────────────┐
│   Frontend (Vite)    │  │      Backend (Spring Boot)    │
│   React + Ant Design │  │         Port 8080             │
│   静态文件由 Nginx 服务 │  │  REST API + 任务调度           │
└──────────────────────┘  └──────────┬────────────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │    AI Worker (FastAPI)         │
                     │        Port 8000              │
                     │  视频分析 + 语音识别 + AI 评分   │
                     └──────────┬────────────────────┘
                                │
          ┌─────────┬───────────┼───────────┬─────────┐
          ▼         ▼           ▼           ▼         ▼
      ┌───────┐ ┌───────┐ ┌─────────┐ ┌────────┐
      │ MySQL │ │ Redis │ │  MinIO  │ │AI 模型  │
      │ 3306  │ │ 6379  │ │ 9000    │ │ API    │
      └───────┘ └───────┘ └─────────┘ └────────┘
```

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | React + Vite + Ant Design | 18.x / 6.x / 5.x |
| 后端 | Spring Boot + JPA | 3.4.0 / Java 17 |
| AI 服务 | FastAPI + OpenAI SDK | 0.115 / 1.93 |
| 数据库 | MySQL | 8.4 |
| 缓存 | Redis | 7.4 |
| 文件存储 | MinIO | 2024-12 |

---

## 2. 环境要求

### 云服务器配置

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 磁盘 | 40 GB SSD | 100 GB SSD |
| 操作系统 | Ubuntu 22.04 / CentOS 8 | Ubuntu 22.04 LTS |
| 公网带宽 | 5 Mbps | 10 Mbps |

### 软件依赖

- Docker >= 24.0
- Docker Compose >= 2.20
- Git

```bash
# 安装 Docker（Ubuntu）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 验证
docker --version
docker compose version
```

---

## 3. 快速部署（Docker Compose）

### 3.1 获取代码

```bash
cd /opt
git clone <your-repo-url> edu-evaluation
cd edu-evaluation/deploy
```

### 3.2 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，**必须修改以下项**：

```bash
# 数据库密码（务必修改）
MYSQL_PASSWORD=your_strong_password_here
MYSQL_ROOT_PASSWORD=your_strong_root_password_here

# MinIO 密码
MINIO_ROOT_PASSWORD=your_minio_password_here

# AI 模型 API Key
MODEL_API_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=sk-your-actual-api-key
```

### 3.3 构建并启动

```bash
# 构建所有镜像并启动（首次约 5-10 分钟）
docker compose up -d --build

# 查看启动状态
docker compose ps

# 查看实时日志
docker compose logs -f
```

### 3.4 验证服务

```bash
# 前端页面
curl -s -o /dev/null -w "%{http_code}" http://localhost
# 期望: 200

# 后端健康检查
curl -s http://localhost/api/actuator/health
# 期望: {"status":"UP"}

# AI Worker 健康检查
curl -s http://localhost:8000/health
# 期望: {"service":"edu-evaluation-ai-worker","status":"ok",...}
```

### 3.5 访问系统

- **前端界面**: `http://<服务器IP>`
- **MinIO 控制台**: `http://<服务器IP>:9001`

---

## 4. 手动部署

如不使用 Docker，可按以下步骤手动部署。

### 4.1 基础设施

```bash
# MySQL 8.0+
sudo apt install mysql-server
sudo mysql -e "CREATE DATABASE edu_evaluation CHARACTER SET utf8mb4;"
sudo mysql -e "CREATE USER 'edu'@'localhost' IDENTIFIED BY 'password';"
sudo mysql -e "GRANT ALL ON edu_evaluation.* TO 'edu'@'localhost';"

# Redis
sudo apt install redis-server

# MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
./minio server /data --console-address ":9001"
```

### 4.2 AI Worker

```bash
cd ai-worker
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
vim .env

# 启动
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

### 4.3 后端

```bash
cd backend

# 编译
mvn clean package -DskipTests

# 启动（可通过环境变量覆盖 application.yml 配置）
java -jar target/*.jar \
  --spring.datasource.url=jdbc:mysql://localhost:3306/edu_evaluation \
  --spring.datasource.username=edu \
  --spring.datasource.password=password \
  --app.ai-worker.base-url=http://localhost:8000
```

### 4.4 前端

```bash
cd frontend
npm ci
npm run build

# 将 dist/ 目录复制到 Nginx
sudo cp -r dist/* /var/www/html/
sudo systemctl restart nginx
```

### 4.5 Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/html;
    index index.html;

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 500m;
        proxy_read_timeout 300s;
    }

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 5. 配置说明

### 5.1 环境变量完整列表

#### 数据库配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_DATABASE` | `edu_evaluation` | 数据库名 |
| `MYSQL_USER` | `edu` | 数据库用户 |
| `MYSQL_PASSWORD` | (必填) | 数据库密码 |
| `MYSQL_ROOT_PASSWORD` | (必填) | Root 密码 |

#### MinIO 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MINIO_ROOT_USER` | `minio` | MinIO 用户名 |
| `MINIO_ROOT_PASSWORD` | (必填) | MinIO 密码 |
| `MINIO_BUCKET` | `coursework-submissions` | 存储桶名 |

#### AI 模型配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MODEL_API_BASE_URL` | (必填) | 模型 API 地址 |
| `MODEL_API_KEY` | (必填) | API Key |
| `MODEL_PROVIDER_DRIVER` | `openai-compatible` | 提供商驱动 |
| `MODEL_TIMEOUT_SECONDS` | `180` | 请求超时(秒) |
| `TEXT_MODEL_NAME` | (可选) | 文本分析模型 |
| `VISION_MODEL_NAME` | (可选) | 视觉分析模型 |
| `MULTIMODAL_MODEL_NAME` | (可选) | 多模态模型 |
| `ASR_MODEL_NAME` | (可选) | 语音识别模型 |

#### 应用配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_PORT` | `80` | 前端对外端口 |

### 5.2 推荐模型配置

```bash
# 方案一：OpenAI
MODEL_API_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=sk-xxx
TEXT_MODEL_NAME=gpt-4o
VISION_MODEL_NAME=gpt-4o
MULTIMODAL_MODEL_NAME=gpt-4o
ASR_MODEL_NAME=whisper-1

# 方案二：兼容 API（如 ClawdRouter、OpenRouter）
MODEL_API_BASE_URL=https://api.example.com/v1
MODEL_API_KEY=sk-xxx
TEXT_MODEL_NAME=claude-sonnet-4-20250514
VISION_MODEL_NAME=claude-sonnet-4-20250514
MULTIMODAL_MODEL_NAME=claude-sonnet-4-20250514
```

---

## 6. 常见问题

### Q: Docker 构建很慢怎么办？

```bash
# 使用国内镜像加速
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF
sudo systemctl restart docker
```

### Q: AI Worker 启动报错 "No module named xxx"？

```bash
# 重新构建镜像
docker compose build --no-cache ai-worker
docker compose up -d ai-worker
```

### Q: 后端连不上 MySQL？

检查 MySQL 是否就绪：
```bash
docker compose logs mysql | grep "ready for connections"
```

### Q: 前端显示 502 Bad Gateway？

后端未启动完成，等待后重试：
```bash
docker compose ps
docker compose logs backend
```

### Q: 视频上传失败？

检查文件大小限制和 MinIO 状态：
```bash
curl -s http://localhost:9000/minio/health/live
```

### Q: 如何修改端口？

编辑 `.env`：
```bash
APP_PORT=8080  # 改为其他端口
```

然后重启：
```bash
docker compose up -d
```

---

## 7. 运维手册

### 7.1 常用命令

```bash
# 查看所有服务状态
docker compose ps

# 查看某个服务日志
docker compose logs -f backend
docker compose logs -f ai-worker

# 重启某个服务
docker compose restart backend

# 停止所有服务
docker compose down

# 停止并删除数据（危险！）
docker compose down -v
```

### 7.2 数据备份

```bash
# MySQL 备份
docker exec edu-mysql mysqldump -u root -p edu_evaluation > backup_$(date +%Y%m%d).sql

# MySQL 恢复
docker exec -i edu-mysql mysql -u root -p edu_evaluation < backup_20260702.sql

# MinIO 数据备份
docker compose stop minio
cp -r /var/lib/docker/volumes/edu-evaluation_minio_data /backup/minio_$(date +%Y%m%d)
docker compose start minio
```

### 7.3 日志管理

```bash
# 限制容器日志大小（在 docker-compose.yml 中添加）
services:
  backend:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### 7.4 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并部署
docker compose up -d --build

# 仅更新某个服务
docker compose up -d --build backend
```

### 7.5 磁盘清理

```bash
# 清理无用镜像
docker image prune -a

# 清理构建缓存
docker builder prune

# 查看磁盘使用
docker system df
```

---

## 8. 安全建议

### 8.1 必须做

- [ ] 修改所有默认密码（MySQL、MinIO）
- [ ] 使用强密码（16+ 字符，含大小写+数字+特殊字符）
- [ ] 配置防火墙，仅开放 80/443 端口
- [ ] 定期备份数据库
- [ ] 使用 HTTPS（见下方配置）

### 8.2 防火墙配置

```bash
# UFW（Ubuntu）
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 3306/tcp   # 禁止外部访问 MySQL
sudo ufw deny 9000/tcp   # 禁止外部访问 MinIO
sudo ufw deny 8080/tcp   # 禁止外部访问后端
sudo ufw deny 8000/tcp   # 禁止外部访问 AI Worker
sudo ufw enable
```

### 8.3 配置 HTTPS（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

Nginx 配置会自动更新，或手动添加：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # ... 其余配置同前
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

### 8.4 API Key 安全

- 不要将 `.env` 文件提交到 Git
- 定期轮换 API Key
- 使用有额度限制的 API Key
- 监控 API 调用量

---

## 附录：端口参考

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|----------|----------|------|
| Frontend (Nginx) | 80 | 80/443 | 唯一对外端口 |
| Backend | 8080 | - | 内部通信 |
| AI Worker | 8000 | - | 内部通信 |
| MySQL | 3306 | - | 内部通信 |
| Redis | 6379 | - | 内部通信 |
| MinIO API | 9000 | - | 内部通信 |
| MinIO Console | 9001 | - | 可选对外 |
