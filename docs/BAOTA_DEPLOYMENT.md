# 教育评估系统 — 宝塔面板部署指南

## 目录

- [1. 环境准备](#1-环境准备)
- [2. 安装宝塔面板](#2-安装宝塔面板)
- [3. 安装 Docker](#3-安装-docker)
- [4. 上传项目代码](#4-上传项目代码)
- [5. 配置环境变量](#5-配置环境变量)
- [6. 构建并启动](#6-构建并启动)
- [7. 配置反向代理](#7-配置反向代理)
- [8. 配置 HTTPS](#8-配置-https)
- [9. 防火墙配置](#9-防火墙配置)
- [10. 验证部署](#10-验证部署)
- [11. 运维管理](#11-运维管理)
- [12. 常见问题](#12-常见问题)

---

## 1. 环境准备

### 服务器配置要求

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Ubuntu 20.04 / CentOS 7.9 | Ubuntu 22.04 LTS |
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 磁盘 | 40 GB SSD | 100 GB SSD |
| 带宽 | 5 Mbps | 10 Mbps |

### 购买云服务器

推荐云服务商（新用户有优惠）：

| 厂商 | 推荐机型 | 参考价格 |
|------|----------|----------|
| 阿里云 | ecs.c7.xlarge (4C8G) | ~200元/月 |
| 腾讯云 | S5.MEDIUM4 (4C8G) | ~180元/月 |
| 华为云 | s6.xlarge.2 (4C8G) | ~190元/月 |

**购买时注意：**
- 选择 Ubuntu 22.04 LTS 系统
- 开放安全组端口：22, 80, 443
- 设置好 SSH 密钥或密码

---

## 2. 安装宝塔面板

### 2.1 SSH 连接服务器

```bash
ssh root@你的服务器IP
```

### 2.2 安装宝塔

**Ubuntu/Debian：**

```bash
# 更新系统
apt update && apt upgrade -y

# 安装宝塔 9.x
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && bash install.sh
```

**CentOS：**

```bash
yum install -y wget && wget -O install.sh https://download.bt.cn/install/install_6.0.sh && sh install.sh
```

### 2.3 记录面板信息

安装完成后会显示：

```
==================================================================
Bt-Panel: http://你的服务器IP:8888/安全入口
username: xxxxxxxx
password: xxxxxxxx
==================================================================
```

**务必保存此信息！**

### 2.4 登录并初始化

1. 浏览器访问面板地址
2. 首次登录会提示安装套件，选择 **LNMP**（Nginx + MySQL + PHP）
3. **取消勾选 MySQL**（我们用 Docker 部署 MySQL）
4. 等待 Nginx 安装完成

---

## 3. 安装 Docker

### 3.1 通过宝塔安装

1. 左侧菜单 → **Docker**
2. 如果提示「未安装 Docker」，点击 **立即安装**
3. 等待安装完成（约 2-3 分钟）
4. 确认 Docker 状态为「运行中」

### 3.2 配置镜像加速

宝塔 Docker 页面 → **配置** → **镜像加速**，添加：

```json
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://registry.docker-cn.com"
  ]
}
```

点击 **保存** → **重启 Docker**。

### 3.3 验证 Docker

SSH 中执行：

```bash
docker --version
# Docker version 27.x.x

docker compose version
# Docker Compose version v2.x.x
```

---

## 4. 上传项目代码

### 4.1 方式一：Git 拉取（推荐）

SSH 中执行：

```bash
cd /www/wwwroot
git clone https://github.com/你的用户名/edu-evaluation.git
```

### 4.2 方式二：宝塔文件管理器上传

1. 宝塔面板 → **文件** → 进入 `/www/wwwroot/`
2. 点击 **上传** → 选择本地 `edu-evaluation` 整个文件夹
3. 等待上传完成

### 4.3 方式三：压缩包上传

```bash
# 本地打包
tar -czf edu-evaluation.tar.gz edu-evaluation/

# 上传到服务器后解压
cd /www/wwwroot
tar -xzf edu-evaluation.tar.gz
```

### 4.4 确认目录结构

```bash
ls /www/wwwroot/edu-evaluation/
# 应该看到：
# ai-worker/  backend/  deploy/  docs/  frontend/  infra/
```

---

## 5. 配置环境变量

### 5.1 创建配置文件

```bash
cd /www/wwwroot/edu-evaluation/deploy
cp .env.example .env
```

### 5.2 编辑配置文件

在宝塔「文件」中找到 `/www/wwwroot/edu-evaluation/deploy/.env`，点击编辑，或用命令行：

```bash
vim /www/wwwroot/edu-evaluation/deploy/.env
```

### 5.3 完整配置模板

```bash
# ============================================================
#  教育评估系统 — 环境变量配置
# ============================================================

# ---------- 应用端口 ----------
# 宝塔默认占用 80 端口，改用其他端口
APP_PORT=8088

# ---------- MySQL ----------
MYSQL_DATABASE=edu_evaluation
MYSQL_USER=edu
MYSQL_PASSWORD=Edu@2026Secure!
MYSQL_ROOT_PASSWORD=Root@2026Secure!

# ---------- RabbitMQ ----------
RABBITMQ_USER=edu
RABBITMQ_PASSWORD=Rabbit@2026Secure!

# ---------- MinIO ----------
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=Minio@2026Secure!
MINIO_BUCKET=coursework-submissions

# ---------- AI 模型配置 ----------
# 必填：模型 API 地址和密钥
MODEL_API_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=sk-你的API密钥

# 驱动类型（一般不需要改）
MODEL_PROVIDER_DRIVER=openai-compatible
MODEL_TIMEOUT_SECONDS=180

# ---------- 模型名称（按需填写）----------
# 文本分析模型
TEXT_PROVIDER_NAME=openai
TEXT_MODEL_NAME=gpt-4o

# 视觉分析模型
VISION_PROVIDER_NAME=openai
VISION_MODEL_NAME=gpt-4o

# 多模态模型
MULTIMODAL_PROVIDER_NAME=openai
MULTIMODAL_MODEL_NAME=gpt-4o

# 语音识别模型
ASR_PROVIDER_NAME=openai
ASR_MODEL_NAME=whisper-1

# OCR 模型（留空则使用本地 PaddleOCR）
OCR_PROVIDER_NAME=
OCR_MODEL_NAME=

# ---------- 高级配置（一般不需要改）----------
# MYSQL_PORT=3306
# REDIS_PORT=6379
# MINIO_API_PORT=9000
# MINIO_CONSOLE_PORT=9001
# RABBITMQ_PORT=5672
# RABBITMQ_CONSOLE_PORT=15672
```

### 5.4 密码安全要求

| 服务 | 密码要求 |
|------|----------|
| MySQL | 8+ 字符，含大小写+数字+特殊字符 |
| MinIO | 8+ 字符 |
| RabbitMQ | 8+ 字符 |
| API Key | 从模型提供商获取 |

---

## 6. 构建并启动

### 6.1 构建镜像

```bash
cd /www/wwwroot/edu-evaluation/deploy

# 构建所有服务（首次约 5-10 分钟）
docker compose build
```

构建过程输出示例：

```
[+] Building 180.5s (25/25) FINISHED
 => [frontend] Building...
 => [backend] Building...
 => [ai-worker] Building...
```

### 6.2 启动服务

```bash
# 后台启动所有服务
docker compose up -d

# 查看启动状态
docker compose ps
```

预期输出：

```
NAME                STATUS          PORTS
edu-mysql           Up (healthy)    3306:3306
edu-redis           Up (healthy)    6379:6379
edu-minio           Up (healthy)    9000:9000, 9001:9001
edu-rabbitmq        Up (healthy)    5672:5672, 15672:15672
edu-ai-worker       Up (healthy)    8000:8000
edu-backend         Up (healthy)    8080:8080
edu-frontend        Up              80:80 -> 0.0.0.0:8088
```

### 6.3 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看某个服务日志
docker compose logs -f backend
docker compose logs -f ai-worker
```

---

## 7. 配置反向代理

### 7.1 添加站点

1. 宝塔面板 → **网站** → **添加站点**
2. 填写信息：
   - **域名**：你的域名 或 服务器IP
   - **PHP版本**：选择「纯静态」
   - **网站目录**：`/www/wwwroot/edu-evaluation`
3. 点击 **提交**

### 7.2 配置反向代理

1. 点击刚创建的站点名
2. 左侧菜单 → **反向代理** → **添加反向代理**
3. 填写：
   - **代理名称**：`edu-evaluation`
   - **目标URL**：`http://127.0.0.1:8088`
   - **发送域名**：`$host`
4. 点击 **提交**

### 7.3 修改 Nginx 配置

反向代理创建后，点击 **配置文件**，替换为以下内容：

```nginx
server {
    listen 80;
    server_name 你的域名.com;  # 或填写服务器IP

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # API 代理 — 转发到 Docker 容器
    location /api/ {
        proxy_pass http://127.0.0.1:8088/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 500m;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
    }

    # 前端页面
    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        proxy_pass http://127.0.0.1:8088;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

点击 **保存**。

---

## 8. 配置 HTTPS

### 8.1 申请免费 SSL 证书

1. 宝塔面板 → **网站** → 点击站点名 → **SSL**
2. 选择 **Let's Encrypt**
3. 填写邮箱，点击 **申请**
4. 等待证书申请成功
5. 开启 **强制 HTTPS**

### 8.2 手动上传证书

如果已有证书（如阿里云免费证书）：

1. 宝塔面板 → **网站** → 点击站点名 → **SSL**
2. 选择 **其他证书**
3. 粘贴 **证书(PEM)** 和 **密钥(KEY)**
4. 点击 **保存** → 开启 **强制 HTTPS**

---

## 9. 防火墙配置

### 9.1 宝塔面板防火墙

宝塔面板 → **安全** → **防火墙**，放行以下端口：

| 端口 | 协议 | 说明 | 是否必须 |
|------|------|------|----------|
| 22 | TCP | SSH | ✅ 必须 |
| 80 | TCP | HTTP | ✅ 必须 |
| 443 | TCP | HTTPS | ✅ 必须 |
| 8888 | TCP | 宝塔面板 | ✅ 必须 |
| 8088 | TCP | 应用端口 | ⚠️ 配了反向代理可不开 |
| 9001 | TCP | MinIO 控制台 | ❌ 按需 |
| 15672 | TCP | RabbitMQ 控制台 | ❌ 按需 |

### 9.2 云服务商安全组

在阿里云/腾讯云控制台 → **安全组** 中放行相同端口：

```
入站规则：
TCP 22    允许  0.0.0.0/0  SSH
TCP 80    允许  0.0.0.0/0  HTTP
TCP 443   允许  0.0.0.0/0  HTTPS
TCP 8888  允许  你的IP/32  宝塔面板（仅自己可访问）
```

### 9.3 限制宝塔面板访问 IP

宝塔面板 → **安全** → **面板设置** → **授权IP**：

```
你的办公IP
你的家庭IP
```

这样只有指定 IP 才能访问宝塔面板。

---

## 10. 验证部署

### 10.1 检查容器状态

```bash
cd /www/wwwroot/edu-evaluation/deploy
docker compose ps
```

所有容器状态应为 `Up (healthy)`。

### 10.2 检查服务健康

```bash
# 前端
curl -s -o /dev/null -w "%{http_code}" http://localhost:8088
# 期望: 200

# 后端
curl -s http://localhost:8088/api/actuator/health
# 期望: {"status":"UP"}

# AI Worker（内部访问）
docker exec edu-ai-worker curl -s http://localhost:8000/health
# 期望: {"status":"ok",...}
```

### 10.3 浏览器访问

| 地址 | 说明 |
|------|------|
| `http://你的域名` | 前端界面 |
| `https://你的域名` | 前端界面（HTTPS） |
| `http://你的IP:9001` | MinIO 控制台 |
| `http://你的IP:15672` | RabbitMQ 控制台 |

---

## 11. 运维管理

### 11.1 常用命令

```bash
# 进入部署目录
cd /www/wwwroot/edu-evaluation/deploy

# 查看所有容器状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 查看某个服务日志
docker compose logs -f backend
docker compose logs -f ai-worker

# 重启所有服务
docker compose restart

# 重启某个服务
docker compose restart backend

# 停止所有服务
docker compose down

# 启动所有服务
docker compose up -d
```

### 11.2 更新部署

```bash
# 拉取最新代码
cd /www/wwwroot/edu-evaluation
git pull

# 重新构建并部署
cd deploy
docker compose up -d --build

# 仅更新某个服务
docker compose up -d --build backend
```

### 11.3 数据备份

**MySQL 备份：**

```bash
# 备份
docker exec edu-mysql mysqldump -u root -p"Edu@2026Secure!" edu_evaluation > /www/backup/mysql_$(date +%Y%m%d).sql

# 恢复
docker exec -i edu-mysql mysql -u root -p"Edu@2026Secure!" edu_evaluation < /www/backup/mysql_20260702.sql
```

**MinIO 备份：**

```bash
# 停止 MinIO
docker compose stop minio

# 备份数据
cp -r /var/lib/docker/volumes/edu-evaluation_minio_data /www/backup/minio_$(date +%Y%m%d)

# 启动 MinIO
docker compose start minio
```

**自动备份脚本：**

```bash
# 创建备份脚本
cat > /www/backup/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR=/www/backup/$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# MySQL
docker exec edu-mysql mysqldump -u root -p"Edu@2026Secure!" edu_evaluation > $BACKUP_DIR/mysql.sql

# 清理 7 天前的备份
find /www/backup -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
EOF

chmod +x /www/backup/backup.sh

# 添加定时任务（每天凌晨 3 点）
crontab -e
# 添加：
0 3 * * * /www/backup/backup.sh
```

### 11.4 日志管理

在 `docker-compose.yml` 中添加日志限制：

```yaml
services:
  backend:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### 11.5 磁盘清理

```bash
# 查看 Docker 磁盘使用
docker system df

# 清理无用镜像
docker image prune -a

# 清理构建缓存
docker builder prune

# 清理所有无用数据
docker system prune -a
```

---

## 12. 常见问题

### Q1: 构建镜像很慢怎么办？

配置镜像加速（见第 3.2 节），或使用代理：

```bash
# 构建时使用代理
HTTP_PROXY=http://your-proxy:port HTTPS_PROXY=http://your-proxy:port docker compose build
```

### Q2: 端口被占用怎么办？

```bash
# 查看端口占用
netstat -tlnp | grep :80
netstat -tlnp | grep :8088

# 修改 .env 中的 APP_PORT
APP_PORT=9090
docker compose up -d
```

### Q3: 容器启动失败怎么办？

```bash
# 查看失败原因
docker compose logs backend

# 常见原因：
# 1. MySQL 未就绪 → 等待 30 秒后重试
# 2. 密码不一致 → 检查 .env 配置
# 3. 端口冲突 → 修改端口
```

### Q4: 前端显示 502 Bad Gateway？

```bash
# 检查后端是否正常
docker compose ps backend
docker compose logs backend

# 检查端口是否正确
curl http://localhost:8088/api/actuator/health
```

### Q5: 视频上传失败？

```bash
# 检查 MinIO 状态
docker compose ps minio

# 检查文件大小限制
# Nginx 配置中 client_max_body_size 应 >= 500m
```

### Q6: AI 分析超时？

```bash
# 检查 API Key 是否正确
docker exec edu-ai-worker env | grep MODEL_API_KEY

# 增加超时时间
# .env 中修改
MODEL_TIMEOUT_SECONDS=300
```

### Q7: 如何查看数据库内容？

```bash
# 进入 MySQL 容器
docker exec -it edu-mysql mysql -u edu -p edu_evaluation

# 查看表
SHOW TABLES;

# 查看任务
SELECT task_id, file_name, status, created_at FROM video_tasks;
```

### Q8: 如何重置所有数据？

```bash
# 停止并删除所有数据（危险！）
cd /www/wwwroot/edu-evaluation/deploy
docker compose down -v

# 重新启动
docker compose up -d --build
```

### Q9: 宝塔面板打不开？

```bash
# 检查宝塔状态
bt status

# 重启宝塔
bt restart

# 修改宝塔端口
bt default
```

### Q10: 如何迁移到新服务器？

```bash
# 旧服务器
docker compose down
tar -czf edu-evaluation.tar.gz /www/wwwroot/edu-evaluation
docker exec edu-mysql mysqldump -u root -p edu_evaluation > mysql_backup.sql

# 新服务器
tar -xzf edu-evaluation.tar.gz -C /www/wwwroot/
cd /www/wwwroot/edu-evaluation/deploy
docker compose up -d --build
# 导入数据库
docker exec -i edu-mysql mysql -u root -p edu_evaluation < mysql_backup.sql
```

---

## 附录：部署检查清单

部署完成后，逐项检查：

- [ ] `docker compose ps` 所有容器 Up (healthy)
- [ ] `http://IP` 能打开前端页面
- [ ] 上传视频文件成功
- [ ] 视频分析任务能正常提交
- [ ] 分析结果能正常显示
- [ ] MinIO 控制台能访问（如需要）
- [ ] 防火墙已正确配置
- [ ] 已修改所有默认密码
- [ ] 已配置 HTTPS（如有域名）
- [ ] 已设置自动备份
