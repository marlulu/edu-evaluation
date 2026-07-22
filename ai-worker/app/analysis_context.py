from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field


class AnalysisStage(str, Enum):
    MANIFEST = "manifest"
    EXTRACT = "extract"
    TRANSCRIBE = "transcribe"
    SUMMARIZE = "summarize"
    ASSESS = "assess"


class AnalysisTraceEvent(BaseModel):
    stage: AnalysisStage
    batch_index: int | None = None
    status: str = "pending"
    evidence_ids: list[str] = Field(default_factory=list)
    request_preview: str = ""
    estimated_input_tokens: int = 0
    estimated_output_tokens: int = 0
    response_summary: str = ""
    duration_ms: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RollingAnalysisContext(BaseModel):
    rule_summary: str = ""
    completeness_summary: str = ""
    batch_summaries: list[str] = Field(default_factory=list)

    def append_batch_summary(self, summary: str, limit: int = 8) -> None:
        if summary.strip():
            self.batch_summaries.append(summary.strip())
            self.batch_summaries = self.batch_summaries[-limit:]

    def render(self, max_characters: int = 6000) -> str:
        value = "\n".join(
            part for part in [
                f"Rules: {self.rule_summary}" if self.rule_summary else "",
                f"Completeness: {self.completeness_summary}" if self.completeness_summary else "",
                "Prior batches:\n" + "\n".join(self.batch_summaries) if self.batch_summaries else "",
            ] if part
        )
        return value[:max_characters]


def estimate_tokens(text: str) -> int:
    """Conservative display-only estimate; model billing remains provider-authoritative."""
    return max(1, len(text) // 3)
