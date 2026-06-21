from datetime import datetime, timezone

from fastapi import FastAPI

app = FastAPI(
    title="AI Coursework Evaluation Worker",
    version="0.1.0",
    description="Framework shell for future extraction and AI evaluation jobs.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "service": "edu-evaluation-ai-worker",
        "status": "ok",
        "time": datetime.now(timezone.utc).isoformat(),
    }
