# AI Coursework Evaluation System

Framework scaffold for an "Introduction to Artificial Intelligence" coursework evaluation system.

For a detailed description of the technology stack, local startup flow, validation commands, and deployment recommendations, see [docs/TECHNICAL_GUIDE.md](docs/TECHNICAL_GUIDE.md).

## Architecture

```text
frontend/   React + TypeScript + Vite UI
backend/    Spring Boot API and business orchestration
ai-worker/  Python FastAPI service for future extraction and AI evaluation
infra/      Local MySQL, Redis, MinIO, and RabbitMQ Docker Compose setup
```

The frontend calls the Spring Boot backend. The backend owns business APIs, persistence, file metadata, and orchestration. The AI Worker is a separate service reserved for document parsing, OCR/ASR, video processing, and LLM evaluation in later milestones.

## Current Scope

This scaffold intentionally includes only application shells, health endpoints, and local infrastructure wiring. Upload, authentication, grading, extraction, persistence workflows, and AI evaluation are deferred.

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
- RabbitMQ Management: `http://localhost:15672`
