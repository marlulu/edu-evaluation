# Docker 离线部署通用教程

适用于无法直接访问 Docker Hub / npm / Maven 的服务器环境（如国内服务器）。

---

## 一、本地打包（有网络的机器）

### 1.1 打包 Docker 镜像

```bash
# 拉取所需镜像
docker pull mysql:8.0
docker pull redis:7-alpine
docker pull node:20-alpine
# ... 其他需要的镜像

# 保存为 tar 包
docker save -o docker-images.tar mysql:8.0 redis:7-alpine node:20-alpine

# 如果镜像较大，可以分包
docker save mysql:8.0 | gzip > mysql.tar.gz
docker save redis:7-alpine | gzip > redis.tar.gz
```

### 1.2 打包项目依赖（可选）

**Node.js 项目：**
```bash
cd frontend
npm ci
tar -czf node_modules.tar.gz node_modules
```

**Python 项目：**
```bash
cd ai-worker
pip download -r requirements.txt -d ./packages/
tar -czf python-packages.tar.gz packages/
```

**Java 项目（Maven）：**
```bash
# Maven 依赖会自动缓存，无需额外打包
# 但需要配置国内镜像加速构建
```

### 1.3 上传到服务器

```bash
# 方式一：scp
scp docker-images.tar user@server:/opt/project/

# 方式二：rsync（支持断点续传）
rsync -avz --progress docker-images.tar user@server:/opt/project/

# 方式三：先传到中转站（如 MinIO/OSS），再在服务器下载
```

---

## 二、服务器准备

### 2.1 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# CentOS
yum install -y docker-ce docker-ce-cli containerd.io
systemctl enable docker
systemctl start docker
```

### 2.2 配置 Docker 镜像加速（可选）

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://hub-mirror.c.163.com"
  ]
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 2.3 安装 Docker Compose

```bash
# 方式一：在线安装
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 方式二：离线安装
# 在有网络的机器下载，然后上传
# 下载地址: https://github.com/docker/compose/releases
```

---

## 三、加载镜像

```bash
# 加载单个 tar 包
docker load -i docker-images.tar

# 加载压缩包
gunzip -c mysql.tar.gz | docker load

# 验证
docker images
```

---

## 四、部署项目

### 4.1 克隆代码

```bash
cd /opt
git clone <仓库地址> project-name
cd project-name
```

### 4.2 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置
vim .env
```

### 4.3 启动服务

```bash
cd deploy  # 或 docker-compose 所在目录

# 首次启动
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f [服务名]
```

### 4.4 构建自定义镜像

```bash
# 如果项目有自己的 Dockerfile
docker-compose up -d --build

# 单独构建某个服务
docker-compose build backend
docker-compose up -d backend
```

---

## 五、常见问题

### 5.1 Maven 构建超时（国内服务器）

在 `Dockerfile` 中添加阿里云镜像：

```dockerfile
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

### 5.2 npm 安装慢或失败

在 `Dockerfile` 中添加淘宝镜像：

```dockerfile
RUN npm config set registry https://registry.npmmirror.com
```

### 5.3 pip 安装慢

在 `Dockerfile` 中添加清华镜像：

```dockerfile
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

### 5.4 端口冲突

```bash
# 查看占用端口的进程
netstat -tlnp | grep :3306
# 或
lsof -i :3306

# 解决方案：修改 docker-compose.yml 中的端口映射
# ports:
#   - "3307:3306"  # 改为其他端口
```

### 5.5 容器健康检查失败

确保容器内有 `curl` 或 `wget`：

```dockerfile
# Debian/Ubuntu
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Alpine
RUN apk add --no-cache curl
```

### 5.6 磁盘空间不足

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理构建缓存
docker builder prune

# 查看磁盘使用
docker system df
```

---

## 六、更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose up -d --build

# 或只更新某个服务
docker-compose up -d --build backend
```

---

## 七、备份与恢复

### 7.1 备份数据库

```bash
# MySQL
docker exec mysql-container mysqldump -u root -p database > backup.sql

# PostgreSQL
docker exec pg-container pg_dump -U postgres database > backup.sql
```

### 7.2 恢复数据库

```bash
# MySQL
docker exec -i mysql-container mysql -u root -p database < backup.sql

# PostgreSQL
docker exec -i pg-container psql -U postgres database < backup.sql
```

### 7.3 备份数据卷

```bash
# 备份
docker run --rm -v volume_name:/data -v $(pwd):/backup alpine tar czf /backup/volume_backup.tar.gz -C /data .

# 恢复
docker run --rm -v volume_name:/data -v $(pwd):/backup alpine tar xzf /backup/volume_backup.tar.gz -C /data
```

---

## 八、Docker Compose 模板参考

```yaml
version: '3.8'

services:
  # 数据库
  mysql:
    image: mysql:8.0
    container_name: mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    ports:
      - "3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  # 后端
  backend:
    build: ./backend
    container_name: backend
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/${DB_NAME}
    ports:
      - "8080:8080"
    depends_on:
      mysql:
        condition: service_healthy
    restart: unless-stopped

  # 前端
  frontend:
    build: ./frontend
    container_name: frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  mysql_data:
```

---

## 九、快速命令速查

| 操作 | 命令 |
|------|------|
| 启动所有服务 | `docker-compose up -d` |
| 停止所有服务 | `docker-compose down` |
| 查看运行状态 | `docker-compose ps` |
| 查看日志 | `docker-compose logs -f` |
| 重启某个服务 | `docker-compose restart backend` |
| 进入容器 | `docker exec -it container-name bash` |
| 查看容器资源 | `docker stats` |
| 清理所有停止的容器 | `docker container prune` |
