from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from app.providers.base import ProviderDescriptor


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ParseModality(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"
    ARCHIVE = "archive"
    MULTIMODAL = "multimodal"


class ParseTaskStatus(str, Enum):
    ACCEPTED = "accepted"
    PENDING_CONFIGURATION = "pending_configuration"
    UNSUPPORTED = "unsupported"


class SourceFileRef(BaseModel):
    file_id: str
    file_name: str
    modality: ParseModality
    storage_path: str
    content_type: str | None = None
    size_bytes: int | None = None
    checksum: str | None = None
    archive_member_path: str | None = None


class ParseTaskOptions(BaseModel):
    enable_ocr: bool = True
    enable_asr: bool = True
    extract_keyframes: bool = True
    analyze_quality: bool = True
    analyze_topic: bool = True
    recursive_archive: bool = True
    preserve_traceability: bool = True
    requested_dimensions: list[str] = Field(default_factory=list)


class ParseTrace(BaseModel):
    source_file_id: str
    source_file_name: str
    page_number: int | None = None
    paragraph_index: int | None = None
    timestamp_ms: int | None = None
    shot_index: int | None = None
    frame_index: int | None = None
    bounding_box: list[float] | None = None
    archive_path: str | None = None


class ParsedFeature(BaseModel):
    name: str
    group: str
    value: Any
    confidence: float | None = None
    unit: str | None = None


class EvidenceUnit(BaseModel):
    evidence_id: str = Field(default_factory=lambda: str(uuid4()))
    label: str
    summary: str
    trace: ParseTrace
    features: list[ParsedFeature] = Field(default_factory=list)


class QualityMetric(BaseModel):
    name: str
    value: str
    score: float | None = None
    note: str | None = None


class DerivedArtifact(BaseModel):
    artifact_id: str = Field(default_factory=lambda: str(uuid4()))
    artifact_type: str
    uri: str
    note: str


class FileParseResult(BaseModel):
    file: SourceFileRef
    status: ParseTaskStatus
    summary: str
    planned_steps: list[str] = Field(default_factory=list)
    quality_metrics: list[QualityMetric] = Field(default_factory=list)
    evidence_units: list[EvidenceUnit] = Field(default_factory=list)
    derived_artifacts: list[DerivedArtifact] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ParseIssue(BaseModel):
    code: str
    message: str
    retriable: bool = False


class MultimodalAssociation(BaseModel):
    association_id: str = Field(default_factory=lambda: str(uuid4()))
    related_file_ids: list[str]
    relation_type: str
    note: str


class ParseTaskRequest(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    submission_id: str
    assignment_id: str | None = None
    student_id: str | None = None
    course_id: str | None = None
    files: list[SourceFileRef]
    options: ParseTaskOptions = Field(default_factory=ParseTaskOptions)
    requested_modalities: list[ParseModality] = Field(default_factory=list)
    callback_url: str | None = None


class ParseTaskResponse(BaseModel):
    task_id: str
    submission_id: str
    status: ParseTaskStatus
    accepted_at: str = Field(default_factory=utc_now_iso)
    summary: str
    configured_providers: list[ProviderDescriptor] = Field(default_factory=list)
    file_results: list[FileParseResult] = Field(default_factory=list)
    multimodal_associations: list[MultimodalAssociation] = Field(default_factory=list)
    issues: list[ParseIssue] = Field(default_factory=list)


class ParsingCapability(BaseModel):
    modality: ParseModality
    supported: bool
    planned_steps: list[str] = Field(default_factory=list)
    note: str


class ParsingCapabilitiesResponse(BaseModel):
    generated_at: str = Field(default_factory=utc_now_iso)
    providers: list[ProviderDescriptor] = Field(default_factory=list)
    capabilities: list[ParsingCapability] = Field(default_factory=list)
    note: str
