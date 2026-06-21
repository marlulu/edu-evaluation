# 人工智能概论大作业评价系统技术说明

本文档介绍当前项目的技术栈、目录结构、本地启动方式、验证命令和部署建议。当前代码处于框架脚手架阶段，已包含前端、后端、AI Worker 和本地基础设施骨架，上传、解析、评分、鉴权、持久化业务流程仍在后续阶段实现。

## 1. 项目定位

本项目面向“人工智能概论”课程大作业评价场景，目标是支持学生提交多类型文件，系统抽取可评价内容，并基于课程评分 Rubric 生成结构化分数、证据、问题和改进建议。

当前框架阶段的主要目标：

- 建立前端、后端、AI Worker 和基础设施的工程边界。
- 提供最小可运行服务入口。
- 预留 MySQL、Redis、MinIO、RabbitMQ 和 AI Worker 的配置。
- 提供本地开发和后续部署的基础路径。

## 2. 目录结构

```text
.
├── frontend/      React + TypeScript + Vite 前端应用
├── backend/       Spring Boot 后端 API 服务
├── ai-worker/     Python FastAPI AI 处理服务
├── infra/         本地 Docker Compose 基础设施
├── docs/          项目技术文档
└── README.md      项目入口说明
```

服务边界：

- `frontend/` 负责浏览器 UI、页面路由和管理端交互。
- `backend/` 负责公开 API、业务编排、持久化入口和异步任务调度。
- `ai-worker/` 负责后续文件抽取、OCR/ASR、视频处理和模型评价任务。
- `infra/` 负责本地 MySQL、Redis、MinIO、RabbitMQ 等依赖服务。

## 3. 技术栈

### 3.1 前端

- React `18.3`
- TypeScript `5.7`
- Vite `6`
- Ant Design `5`
- React Router `7`
- TanStack Query `5`
- Axios
- Zustand
- ESLint `9`

前端当前是管理后台风格的最小页面 shell，后续会扩展上传流程、任务状态页、评价报告页和教师调整控件。

### 3.2 后端

- Java `17`
- Spring Boot `3.4`
- Maven
- Spring Web
- Spring Validation
- Spring Boot Actuator
- Spring Data Redis
- Spring AMQP
- MySQL Connector/J

后端当前提供 `/api/health` 健康接口，并预留 MySQL、Redis、RabbitMQ、MinIO 和 AI Worker 的配置项。

### 3.3 AI Worker

- Python `3.11+` 推荐
- FastAPI `0.115`
- Uvicorn `0.32`
- Pydantic `2`
- python-dotenv

AI Worker 当前提供 `/health` 健康接口。后续用于文件内容抽取、音视频转写、图像帧抽取、OCR 和 LLM 评价。

### 3.4 基础设施

本地基础设施由 `infra/docker-compose.yml` 管理：

- MySQL `8.4`
- Redis `7.4-alpine`
- MinIO `RELEASE.2024-12-18T13-15-44Z`
- RabbitMQ `4.0-management`

默认用途：

- MySQL：业务数据源。
- Redis：缓存和轻量运行状态。
- MinIO：原始提交文件和衍生文件存储。
- RabbitMQ：异步解析和评价任务队列。

## 4. 本地启动方式

### 4.1 前置要求

本地开发建议安装：

- Node.js 和 npm
- Java 17
- Maven
- Python 3.11+
- Docker Desktop 或兼容 Docker Compose 的运行环境

如果 Maven 默认本地仓库不可写，可以使用项目内仓库参数：

```bash
mvn "-Dmaven.repo.local=../.m2/repository" ...
```

在 Windows PowerShell 中，带 `-D` 的 Maven 参数建议加引号，避免命令解析错误。

### 4.2 启动基础设施

从项目根目录执行：

```bash
docker compose -f infra/docker-compose.yml up -d
```

停止基础设施：

```bash
docker compose -f infra/docker-compose.yml down
```

如果需要删除本地数据，手动清理 `infra/data/`。该目录已被 `.gitignore` 忽略。

### 4.3 启动后端

```bash
cd backend
mvn spring-boot:run
```

如果需要指定项目内 Maven 仓库：

```bash
cd backend
mvn "-Dmaven.repo.local=../.m2/repository" "-Dmaven.test.skip=true" spring-boot:run
```

健康检查：

```bash
curl http://localhost:8080/api/health
```

预期返回：

```json
{
  "service": "edu-evaluation-backend",
  "status": "ok",
  "time": "..."
}
```

### 4.4 启动前端

```bash
cd frontend
npm install
npm run dev
```

浏览器访问：

```text
http://localhost:5173/
```

常用验证命令：

```bash
npm run lint
npm run build
```

`npm run build` 可能提示 Ant Design 相关主 chunk 超过 500 kB；当前阶段这是体积警告，不影响构建成功。后续业务页面增多后可通过路由级懒加载和手动分包优化。

### 4.5 启动 AI Worker

```bash
cd ai-worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

健康检查：

```bash
curl http://localhost:8001/health
```

当前如果只验证前后端，可以暂时不启动 AI Worker。

## 5. 默认端口

| 服务 | 地址 |
| --- | --- |
| 前端 | `http://localhost:5173/` |
| 后端健康接口 | `http://localhost:8080/api/health` |
| AI Worker 健康接口 | `http://localhost:8001/health` |
| MySQL | `localhost:3306` |
| Redis | `localhost:6379` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| RabbitMQ AMQP | `localhost:5672` |
| RabbitMQ Management | `http://localhost:15672` |

默认账号：

| 服务 | 用户名 | 密码 |
| --- | --- | --- |
| MySQL | `edu` | `edu_password` |
| MySQL root | `root` | `root_password` |
| MinIO | `minio` | `minio_password` |
| RabbitMQ | `edu` | `edu_password` |

## 6. 构建与验证

### 6.1 前端

```bash
cd frontend
npm run lint
npm run build
```

构建产物位于：

```text
frontend/dist/
```

### 6.2 后端

```bash
cd backend
mvn "-Dmaven.repo.local=../.m2/repository" "-Dmaven.test.skip=true" compile
```

如需打包：

```bash
cd backend
mvn "-Dmaven.repo.local=../.m2/repository" "-Dmaven.test.skip=true" package
```

打包产物通常位于：

```text
backend/target/
```

### 6.3 AI Worker

```bash
cd ai-worker
python -m compileall app
```

## 7. 部署方式

当前仓库还没有生产级 Dockerfile、反向代理配置和 CI/CD 流水线。推荐按以下阶段推进部署。

### 7.1 本地单机部署

适用于开发、演示和课程原型验证：

1. 使用 Docker Compose 启动 MySQL、Redis、MinIO 和 RabbitMQ。
2. 使用 `npm run dev` 启动前端开发服务。
3. 使用 `mvn spring-boot:run` 启动后端。
4. 需要 AI 处理能力时启动 `uvicorn app.main:app --reload --port 8001`。

优点是启动简单，便于调试；缺点是不适合公网生产环境。

### 7.2 测试环境部署建议

建议新增以下构件：

- `frontend/Dockerfile`：构建静态资源，并通过 Nginx 提供页面。
- `backend/Dockerfile`：构建 Spring Boot jar 并以 Java 17 运行。
- `ai-worker/Dockerfile`：安装 Python 依赖并运行 Uvicorn。
- `infra/docker-compose.app.yml`：编排前端、后端、AI Worker 和基础设施。
- `.env`：集中管理数据库、对象存储、队列和 AI 服务配置。

推荐流量路径：

```text
Browser -> Nginx/Frontend -> Backend API -> RabbitMQ/Redis/MySQL/MinIO -> AI Worker
```

前端不应直接调用 AI Worker。所有业务请求应进入后端，由后端统一做鉴权、审计、任务编排和结果落库。

### 7.3 生产部署建议

生产环境建议拆分部署：

- 前端静态资源部署到 Nginx、对象存储静态站点或 CDN。
- 后端以容器或 systemd 服务部署，连接托管或独立数据库。
- AI Worker 单独横向扩容，按 CPU/GPU、OCR、ASR 和 LLM 调用负载分配资源。
- MySQL 使用定期备份、主从或云数据库。
- Redis 启用持久化或使用托管实例。
- MinIO 使用独立磁盘和备份策略，或替换为云对象存储。
- RabbitMQ 开启管理、监控和持久化队列配置。

生产环境还需要补充：

- HTTPS 终止和反向代理。
- 鉴权与权限控制。
- 文件大小、类型和安全扫描限制。
- 任务重试、死信队列和失败告警。
- 日志聚合、指标监控和链路追踪。
- 配置加密和密钥管理。

## 8. 常见问题

### 8.1 Maven 写入本地仓库失败

如果出现类似 `F:\maven\repository ... 拒绝访问`，使用项目内 Maven 仓库：

```bash
mvn "-Dmaven.repo.local=../.m2/repository" "-Dmaven.test.skip=true" spring-boot:run
```

### 8.2 Maven 参数被 PowerShell 解析错误

如果出现 `No plugin found for prefix '.repo.local=...'`，说明 `-Dmaven.repo.local` 没有被正确传给 Maven。用引号包裹参数：

```bash
mvn "-Dmaven.repo.local=../.m2/repository" compile
```

### 8.3 前端构建 chunk 体积警告

当前 Ant Design 会带来较大的初始包体，Vite 可能提示 chunk 超过 500 kB。这是警告，不是构建失败。后续可以通过页面懒加载、组件按需加载和 Rollup manual chunks 优化。

### 8.4 AI Worker 依赖下载失败

如果 `pip install -r requirements.txt` 因网络失败，需要确认本机可以访问 PyPI 或配置可用镜像源。只验证前后端时可以暂时跳过 AI Worker。

## 9. 当前状态

已验证：

- 前端依赖安装完成，`npm run lint` 通过。
- 前端 `npm run build` 通过。
- 后端 `mvn compile` 通过。
- 后端 `/api/health` 可返回 `status=ok`。
- Docker Compose 配置可解析。

待后续完善：

- 上传、解析、评价和教师复核业务流程。
- 数据库 schema 和迁移工具。
- 前后端 API 契约。
- AI Worker 任务协议。
- 生产 Dockerfile 和部署编排。
- 鉴权、审计、监控和安全策略。
