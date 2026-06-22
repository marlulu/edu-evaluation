# System Module Map

This document fixes the initial module positions for the coursework evaluation system. The current milestone only reserves boundaries; detailed workflows, data models, and APIs will be discussed and implemented module by module later.

## Module Registry

| Module | Frontend Location | Backend Location | AI Worker Location | Primary Responsibility |
| --- | --- | --- | --- | --- |
| 作业管理模块 | `frontend/src/features/assignment-management/` | `backend/src/main/java/com/example/eduevaluation/assignment/` | N/A | Course assignment setup, submission task creation, submission metadata, and teacher workflow entry points. |
| 多模态内容解析模块 | `frontend/src/features/content-parsing/` | `backend/src/main/java/com/example/eduevaluation/content/` | `ai-worker/app/modules/content_parsing/` | Image/video/audio/text/archive parsing, OCR/ASR, quality analysis, semantic feature extraction, evidence segmentation, and multimodal correlation. |
| 智能评价模块 | `frontend/src/features/intelligent-evaluation/` | `backend/src/main/java/com/example/eduevaluation/evaluation/` | `ai-worker/app/modules/intelligent_evaluation/` | Rubric-driven scoring, model provider integration, scoring evidence, issue detection, and improvement suggestions. |
| 结果展示与反馈模块 | `frontend/src/features/result-feedback/` | `backend/src/main/java/com/example/eduevaluation/result/` | N/A | Evaluation report display, teacher review, manual score adjustment, feedback delivery, and final result state. |
| 系统管理与配置模块 | `frontend/src/features/system-admin/` | `backend/src/main/java/com/example/eduevaluation/system/` | `ai-worker/app/modules/system_config/` | Rubric configuration, model/provider settings, file type policy, infrastructure settings, and operational controls. |

## Extension Rule

When a new module is added later:

1. Add it to this table with a stable English directory name.
2. Add a frontend feature directory under `frontend/src/features/<module-name>/`.
3. Add a backend package under `com.example.eduevaluation.<moduleName>`.
4. Add an AI Worker module only when the module owns parsing, model, OCR, ASR, or other compute-heavy work.
5. Keep browser UI calls routed through the backend; the frontend must not call the AI Worker directly.

## Current Assignment Management Scope

The assignment management module has the first non-AI implementation:

- Frontend: `frontend/src/features/assignment-management/AssignmentManagement.tsx`.
- Backend API prefix: `/api/assignment-management`.
- Metadata storage: in-memory repository for the current MVP.
- File storage: local `backend/data/uploads/`, ignored by Git.
- Implemented capabilities: assignment CRUD, status tracking, version upload records, CSV import/export, category management, class management, and student management.

MySQL and MinIO integration are intentionally deferred to a persistence-focused milestone.

## Current System Administration Scope

The system administration and configuration module has the first non-AI implementation:

- Frontend: `frontend/src/features/system-admin/SystemAdmin.tsx`.
- Backend API prefix: `/api/system-admin`.
- Metadata storage: in-memory repository for the current MVP.
- Implemented capabilities: user role/permission/data-scope management, rubric template configuration and versioning, audit log search/export, backup and restore operation records.

MySQL persistence, real authentication enforcement, scheduled backups, and physical recovery execution are intentionally deferred to later infrastructure and security milestones.

## Current Result Feedback Scope

The result display and feedback module has the first non-AI implementation:

- Frontend: `frontend/src/features/result-feedback/ResultFeedback.tsx`.
- Backend API prefix: `/api/results`.
- Metadata storage: in-memory repository for the current MVP.
- Implemented capabilities: report publishing, radar/bar chart style visualization, detailed student report display, batch CSV export, single-report PDF export, student history lookup, assignment-level comparison, feedback append, and resubmission linkage.

Persistent scoring storage, real review workflows, and production-grade PDF/Excel pipelines are intentionally deferred to later reporting and infrastructure milestones.

## Current Multimodal Content Parsing Scope

The multimodal content parsing module is still a design-stage AI module:

- Detailed scope document: `docs/MULTIMODAL_CONTENT_PARSING.md`
- Planned frontend surface: parsing task status, parsed summary, evidence preview, and review traceability
- Planned backend role: parse task orchestration, file/version binding, queue dispatch, result persistence, and failure recovery
- Planned AI Worker role: image, video, audio, text, archive, and multimodal fusion pipelines

Planned capability areas:

- image understanding, OCR, composition, sharpness, and color analysis
- video metadata extraction, keyframes, shot segmentation, subtitle recognition, and topic recognition
- audio transcription, speech rate, loudness, clarity, pause/rhythm, and expression analysis
- text and supplementary material extraction, keyword/topic/logic analysis
- archive unpacking, file classification, and package-level association analysis
- multimodal feature-to-scoring-indicator mapping

Actual model integration and parsing execution remain deferred to the future AI implementation phase.

## Current Intelligent Evaluation Scope

The intelligent evaluation module is still a design-stage AI module:

- Detailed scope document: `docs/INTELLIGENT_EVALUATION.md`
- Planned frontend surface: evaluation task status, rubric snapshot preview, score explanation view, issue list, suggestion list, and review correction panel
- Planned backend role: evaluation task orchestration, rubric/version binding, review-state persistence, permission enforcement, and report publication handoff
- Planned AI Worker role: rubric-based scoring, issue detection, suggestion generation, score explanation assembly, and manual-review trace support

Planned capability areas:

- rubric-based automatic scoring across item, dimension, and total score levels
- evaluation template version binding and course/task-specific scoring rule selection
- traceable score explanations with evidence mapping
- issue identification, deduction / bonus explanation, and content localization
- differentiated revision suggestions by issue type and score band
- manual review correction records with before/after score traceability

Actual model integration and scoring execution remain deferred to the future AI implementation phase.
