from __future__ import annotations

import sqlite3
from pathlib import Path


class AnalysisJobStore:
    """Small durable store for resumable worker jobs and their review snapshots."""

    def __init__(self, database_path: str = "data/analysis-jobs.sqlite3") -> None:
        path = Path(database_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent / path
        path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(path, check_same_thread=False)
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS analysis_jobs (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        self.connection.commit()

    def save(self, job_id: str, payload: str) -> None:
        self.connection.execute(
            """
            INSERT INTO analysis_jobs (id, payload, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
            """,
            (job_id, payload),
        )
        self.connection.commit()

    def load(self) -> list[str]:
        return [row[0] for row in self.connection.execute(
            "SELECT payload FROM analysis_jobs ORDER BY updated_at DESC"
        )]
