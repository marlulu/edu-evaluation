from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field

from app.modules.content_parsing.base.schemas import ParseTrace
from app.providers.base import ProviderDescriptor


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class EvaluationTaskStatus(str, Enum):
    ACCEPTED = "accepted"
    PENDING_CONFIGURATION = "pending_configuration"
    REVIEW_PENDING = "review_pending"


class RubricRange(BaseModel):
    min_score: float
    max_score: float
    label: str | None = None


class RubricDimension(BaseModel):
    dimension_id: str
    name: str
    weight: float
    scoring_rule: str
    description: str | None = None
    score_range: RubricRange
    deduction_rules: list[str] = Field(default_factory=list)


class RubricSnapshot(BaseModel):
    rubric_id: str
    rubric_name: str
    version: str
    course_scope: list[str] = Field(default_factory=list)
    assignment_scope: list[str] = Field(default_factory=list)
    dimensions: list[RubricDimension] = Field(default_factory=list)


class ParsedEvidenceRef(BaseModel):
    source_file_id: str
    evidence_unit_id: str | None = None
    trace: ParseTrace | None = None
    summary: str


class EvaluationTaskOptions(BaseModel):
    enable_issue_detection: bool = True
    enable_suggestions: bool = True
    enable_bonus_and_deduction_explanation: bool = True
    require_dimension_explanations: bool = True
    score_band_feedback: bool = True


class EvaluationTaskRequest(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    submission_id: str
    assignment_id: str
    course_id: str | None = None
    student_id: str | None = None
    rubric: RubricSnapshot
    parsed_evidence: list[ParsedEvidenceRef] = Field(default_factory=list)
    callback_url: str | None = None
    options: EvaluationTaskOptions = Field(default_factory=EvaluationTaskOptions)


class ScoreEvidence(BaseModel):
    evidence_id: str = Field(default_factory=lambda: str(uuid4()))
    source_file_id: str
    evidence_unit_id: str | None = None
    reason: str
    trace: ParseTrace | None = None


class DimensionScore(BaseModel):
    dimension_id: str
    dimension_name: str
    score: float
    weight: float
    weighted_score: float
    basis: str
    evidence: list[ScoreEvidence] = Field(default_factory=list)


class EvaluationIssue(BaseModel):
    issue_id: str = Field(default_factory=lambda: str(uuid4()))
    category: str
    severity: str
    title: str
    description: str
    dimension_id: str | None = None
    trace: ParseTrace | None = None


class RevisionSuggestion(BaseModel):
    suggestion_id: str = Field(default_factory=lambda: str(uuid4()))
    target_issue_id: str | None = None
    dimension_id: str | None = None
    score_band: str | None = None
    title: str
    details: str


class ReviewRecord(BaseModel):
    review_id: str = Field(default_factory=lambda: str(uuid4()))
    reviewer_id: str
    reviewer_name: str | None = None
    original_total_score: float
    revised_total_score: float
    reason: str
    reviewed_at: str = Field(default_factory=utc_now_iso)


class EvaluationTaskResponse(BaseModel):
    task_id: str
    submission_id: str
    status: EvaluationTaskStatus
    accepted_at: str = Field(default_factory=utc_now_iso)
    rubric_snapshot: RubricSnapshot
    total_score: float
    score_band: str
    summary: str
    dimension_scores: list[DimensionScore] = Field(default_factory=list)
    issues: list[EvaluationIssue] = Field(default_factory=list)
    suggestions: list[RevisionSuggestion] = Field(default_factory=list)
    configured_providers: list[ProviderDescriptor] = Field(default_factory=list)
    review_records: list[ReviewRecord] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class EvaluationReviewRequest(BaseModel):
    task_id: str
    reviewer_id: str
    reviewer_name: str | None = None
    revised_total_score: float
    reason: str


class EvaluationCapability(BaseModel):
    capability: str
    supported: bool
    note: str


class EvaluationCapabilitiesResponse(BaseModel):
    generated_at: str = Field(default_factory=utc_now_iso)
    providers: list[ProviderDescriptor] = Field(default_factory=list)
    capabilities: list[EvaluationCapability] = Field(default_factory=list)
    note: str
