# AI 作品评估系统

AI 作品评估系统，支持作品上传、元数据提取、语音识别、内容分析和质量评估。

For a detailed description of the technology stack, local startup flow, validation commands, and deployment recommendations, see [docs/TECHNICAL_GUIDE.md](docs/TECHNICAL_GUIDE.md).

## Architecture

```text
frontend/   React + TypeScript + Vite UI
backend/    Spring Boot API and business orchestration
ai-worker/  Python FastAPI service for future extraction and AI evaluation
infra/      Local MySQL, Redis, and MinIO Docker Compose setup
```

前端调用 Spring Boot 后端。后端负责业务 API、持久化、文件元数据和编排。AI Worker 是一个独立的服务，用于文档解析、OCR/ASR、作品处理和 LLM 评估。

## Current Scope

This scaffold intentionally includes only application shells, health endpoints, and local infrastructure wiring. Upload, authentication, grading, extraction, persistence workflows, and AI evaluation are deferred.

## Initial System Modules

The first five module positions are fixed in [docs/MODULE_MAP.md](docs/MODULE_MAP.md):

- 作业管理模块
- 多模态内容解析模块
- 智能评价模块
- 结果展示与反馈模块
- 系统管理与配置模块

Future modules should be added to the same module map before implementation so frontend, backend, and AI Worker boundaries stay consistent.

## Assignment Management MVP

The assignment management module now has a non-AI MVP:

- Assignment CRUD, category management, status tracking, and version records.
- Student file upload for images, video, audio, archives, documents, and text files.
- CSV import/export for assignments.
- Student and class management.

Current storage is intentionally lightweight: metadata is held in backend memory and uploaded files are written to `backend/data/uploads/`, which is ignored by Git. A later persistence milestone should replace this with MySQL metadata and MinIO object storage.

## System Administration MVP

The system administration and configuration module now has a non-AI MVP:

- User, role, permission, status, and data-scope management for administrators, teachers, assistants, and students.
- Rubric template configuration with dimensions, weights, scoring rules, course scope, enable/disable state, copy, version history, and historical traceability.
- Audit log search and CSV export for key operations.
- Backup and restore operation records with permission-oriented operator fields and audit trail entries.

Current storage is in-memory for fast prototype iteration. A later persistence milestone should move users, rubric templates, audit logs, and backup metadata into MySQL and connect backup records to real file/object storage snapshots.

## Result Feedback MVP

The result display and feedback module now has a non-AI MVP:

- Visual statistics for class averages and report-level dimension distribution.
- Detailed student-facing evaluation report content with strengths, weaknesses, and revision suggestions.
- CSV export for batch result summaries and PDF export for single reports.
- Student history lookup, assignment-level comparison, and feedback trail display.
- Resubmission flow that links feedback with later assignment versions to form a review-improve-review loop.

Current scoring data is stored in backend memory. A later persistence milestone should move report data, revision history, and feedback loop records into MySQL and attach exports to stable object storage workflows.

## Multimodal Parsing Scope

The multimodal content parsing module is still in design scope, but its detailed target abilities are now documented in [docs/MULTIMODAL_CONTENT_PARSING.md](docs/MULTIMODAL_CONTENT_PARSING.md).

Planned parsing coverage includes:

- image understanding, OCR, composition, sharpness, and color analysis
- work metadata, keyframe extraction, shot segmentation, subtitle recognition, and theme recognition
- audio transcription, speech rate, volume, clarity, pause/rhythm, and expression analysis
- multimodal fusion across image, work, audio, text, and archive submissions
- supplementary document, subtitle, script, and archive unpacking workflows

The current milestone now reserves AI Worker contracts for this module without binding any real model provider yet.

## Multimodal Parsing Placeholders

The AI Worker now exposes placeholder endpoints and provider slots for later model integration:

- `GET /parse/capabilities`
- `GET /parse/providers`
- `POST /parse/tasks`

These endpoints currently return contract-first stub responses so the backend can integrate against a stable surface before real parsing is enabled.

Model connectivity is intentionally left for later through environment variables such as:

- `MODEL_PROVIDER_DRIVER`
- `MODEL_API_BASE_URL`
- `MODEL_API_KEY`
- `VISION_PROVIDER_NAME` / `VISION_MODEL_NAME`
- `SPEECH_PROVIDER_NAME` / `AUDIO_MODEL_NAME`
- `MULTIMODAL_PROVIDER_NAME` / `MULTIMODAL_MODEL_NAME`
- `TEXT_PROVIDER_NAME` / `TEXT_MODEL_NAME`
- `OCR_PROVIDER_NAME` / `OCR_MODEL_NAME`
- `ASR_PROVIDER_NAME` / `ASR_MODEL_NAME`

If these values are not configured, parse tasks remain in a `pending_configuration` placeholder state by design.

For OpenAI-compatible gateways, put credentials in `ai-worker/.env` based on `ai-worker/.env.example` instead of hardcoding keys in source files.

## Intelligent Evaluation Scope

The intelligent evaluation module is the core scoring module. Its detailed target abilities are documented in [docs/INTELLIGENT_EVALUATION.md](docs/INTELLIGENT_EVALUATION.md).

Planned evaluation coverage includes:

- automatic scoring based on rubric dimensions, weights, and rule definitions
- course- and assignment-specific evaluation template selection and version binding
- traceable item, dimension, and total score explanations
- issue identification, deduction or bonus explanation, and source localization
- targeted revision suggestions and score-band differentiated feedback
- manual teacher or assistant review with revision trace records

The current milestone now reserves AI Worker contracts for this module without binding any real evaluation model provider yet.

## Intelligent Evaluation Placeholders

The AI Worker now exposes placeholder endpoints and contract slots for later scoring integration:

- `GET /evaluate/capabilities`
- `POST /evaluate/tasks`
- `POST /evaluate/reviews`

These endpoints currently return contract-first stub responses so the backend can integrate against a stable evaluation surface before real automatic scoring is enabled.

## Local Services

Start infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Run the backend:

```bash
cd backend
mvn spring-boot:run
```

Run the AI Worker:

```bash
cd ai-worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

## Default Ports

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080/api/health`
- AI Worker: `http://localhost:8001/health`
- MySQL: `localhost:3306`
- Redis: `localhost:6379`
- MinIO Console: `http://localhost:9001`