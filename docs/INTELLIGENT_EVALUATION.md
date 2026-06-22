# Intelligent Evaluation Module

This document captures the detailed scope of the intelligent evaluation module. It defines what the scoring layer must consume, what outputs it should generate, and how teachers can review and revise those outputs later.

## Module Position

- Frontend location: `frontend/src/features/intelligent-evaluation/`
- Backend location: `backend/src/main/java/com/example/eduevaluation/evaluation/`
- AI Worker location: `ai-worker/app/modules/intelligent_evaluation/`

The backend remains the orchestration boundary. The AI Worker owns model-facing scoring execution, evidence matching, issue discovery, suggestion generation, and review-ready trace output.

## Goal

Support rubric-driven automatic evaluation for coursework submissions after content parsing has already produced structured evidence, extracted features, and traceable artifacts.

The intelligent evaluation module is responsible for:

1. rubric-based automatic scoring
2. evaluation-template execution
3. evidence-to-dimension matching
4. issue identification and location
5. suggestion generation
6. review traceability and manual correction support

## Functional Scope

### 1. Automatic Scoring Based On Evaluation Indicators

The system should support automatic scoring according to preconfigured course rubrics and assignment-specific evaluation templates.

Scoring dimensions may include but are not limited to:

- content completeness
- topic relevance
- technical implementation quality
- expression logic
- innovation
-规范性 / standards compliance

The system should output:

- item-level scores
- dimension-level scores
- total score
- scoring basis for each result

### 2. Custom Evaluation Standard Configuration

Teachers and administrators should be able to configure evaluation standards, including:

- indicator items
- weights
- score ranges
- scoring rules
- scoring descriptions
- deduction rules

Different courses and assignment tasks should be able to use different rubric templates.

Historical scoring results must remain tied to the rubric version that was active at scoring time.

### 3. Traceable And Explainable Scoring Process

The system should record the scoring process end to end, including:

- input assignment files
- parsing results
- extracted features
- dimension matching
- scoring rule calls
- final scoring conclusions

Each score should be traceable to:

- evaluation dimension
- supporting evidence
- rule decision basis

For bonus or deduction items, the system should produce readable explanations for teachers and students.

### 4. Problem Identification And Defect Localization

The system should identify assignment problems in the context of evaluation dimensions and indicate problem category plus relevant source location.

Example problem groups include:

- technical defects
- logic errors
- off-topic content
- unclear expression
- incomplete structure
- weak originality
- standards-compliance issues

For video, image, audio, or text submissions, the system should point back to timestamps, frames, text fragments, or other relevant trace features where possible.

### 5. Revision Suggestions And Improvement Feedback

The system should generate targeted modification suggestions from detected issues.

Suggestions should explain:

- what is wrong
- how to improve it
- which direction to optimize
- what stronger performance looks like

The system should support differentiated feedback by score band so high-, medium-, and low-performing work does not receive the same generic guidance.

### 6. Manual Review And Score Correction

Teachers or assistants should be able to review and revise automatic scoring results.

Reviewers should be able to inspect:

- dimension scores
- evidence references
- issue explanations
- system-generated suggestions

The system should record:

- original score
- revised score
- revision reason
- reviewer
- revision time

## Output Requirements

The intelligent evaluation module should produce structured outputs that later reporting modules can consume directly.

### Core Output Categories

- rubric snapshot
- dimension scores
- total score
- evidence references
- issue records
- deduction / bonus explanations
- revision suggestions
- review trail

### Traceability Requirements

Every evaluation output should reference upstream parsing and file-level evidence where possible, such as:

- source file id
- evidence unit id
- timestamp
- frame index
- page / paragraph position
- archive member path

## Suggested AI Worker Breakdown

```text
ai-worker/app/modules/intelligent_evaluation/
  base/
    schemas.py
    rubric.py
    trace.py
  scoring/
    dimension_matcher.py
    rule_executor.py
    score_aggregator.py
  issues/
    detector.py
    locator.py
  feedback/
    suggestions.py
    score_band_feedback.py
  review/
    revision_log.py
    reconciliation.py
  pipelines/
    evaluation_pipeline.py
    review_pipeline.py
```

## Dependencies On Other Modules

### Upstream

- assignment management provides submission, student, course, and version context
- content parsing provides structured features, evidence units, and traceable artifacts
- system administration provides rubric templates, version history, and permission boundaries

### Downstream

- result feedback consumes evaluation reports, explanations, issues, and revision history

## Deferred Implementation Notes

This document captures the target scope only. The current repository still treats intelligent evaluation as a future AI-enabled module.

The current codebase should reserve:

- evaluation request/response schemas
- rubric snapshot contract
- evidence trace contract
- issue and suggestion output contract
- manual review trace contract
- placeholder API surface for scoring and review workflows

Before real implementation begins, the next design step should define:

1. first-phase rubric execution format
2. structured score explanation schema
3. scoring job protocol between backend and AI Worker
4. teacher correction merge strategy
5. fallback behavior when evidence is partial or confidence is low
