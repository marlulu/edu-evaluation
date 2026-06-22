# Multimodal Content Parsing Module

This document captures the detailed scope of the multimodal content parsing module. It describes what the module must be able to analyze, what kinds of structured outputs it should produce, and how those outputs should support later scoring workflows.

## Module Position

- Frontend location: `frontend/src/features/content-parsing/`
- Backend location: `backend/src/main/java/com/example/eduevaluation/content/`
- AI Worker location: `ai-worker/app/modules/content_parsing/`

The backend remains the orchestration boundary. The AI Worker owns actual parsing and extraction. The frontend should only display task status, parsed summaries, and reviewable evidence.

## Goal

Support image, video, audio, text, and archive-based coursework submissions by extracting structured, reviewable, score-ready features instead of only storing raw files.

The parsing module is responsible for:

1. content extraction
2. quality and technical analysis
3. semantic feature extraction
4. evidence segmentation and traceability
5. multimodal correlation across files

## Functional Scope

### 1. Image Content Parsing

The system should support image-based coursework analysis, including but not limited to:

- primary subject recognition
- scene understanding
- object detection
- OCR text recognition
- composition feature extraction
- sharpness / clarity analysis
- color distribution analysis
- technical quality indicators
- content-expression indicators

The system should identify key elements in images and convert them into structured features relevant to course evaluation.

For design, photography, or presentation-oriented assignments, the system should extract evidence from both:

- technical execution
- content expression

### 2. Video Content Parsing

The system should support automatic video analysis, including at least:

- video metadata extraction
- keyframe extraction
- shot segmentation
- duration analysis
- visual structure analysis
- subtitle / on-screen text recognition
- topic recognition

The system should identify score-relevant fragments from the video and keep a replayable parsing trail.

For videos with narration, explanation, or demonstration processes, the system should jointly analyze:

- visual content
- speech transcript content

### 3. Audio Content Parsing

The system should support audio coursework analysis, including at least:

- speech-to-text transcription
- speech rate analysis
- loudness / volume analysis
- clarity analysis
- pause and rhythm analysis

For oral presentation, speech, reading, or explanation assignments, the system should assist analysis of:

- spoken content
- fluency
- pronunciation quality
- emotional expression

The system should convert audio parsing outputs into structured text and feature data that can later be scored.

### 4. Multimodal Joint Analysis

The system should support multimodal fusion across:

- image
- video
- audio
- text

It should support mapping between:

- assignment content
- extracted features
- scoring criteria

For submissions composed of multiple files, the system should analyze them as one connected assignment package instead of isolated single files.

### 5. Text And Supplementary Material Parsing

The system should support analysis of supplementary materials such as:

- instructions
- reports
- subtitle files
- scripts
- explanatory text

Supported parsing abilities should include:

- text extraction
- structure recognition
- keyword extraction
- topic summarization
- logical relation analysis

For archive submissions, the system should support:

- automatic unpacking
- directory recognition
- file classification
- extraction of parseable content

## Output Requirements

The parsing module should produce structured outputs that later modules can consume directly.

### Core Output Categories

- source file metadata
- derived artifacts
- segmented evidence units
- technical quality metrics
- semantic features
- multimodal associations
- parsing errors and confidence

### Evidence Traceability

Every extracted result should point back to a traceable source position where possible, such as:

- page number
- paragraph or block index
- timestamp
- shot index
- frame index
- bounding box
- file path inside an archive

## Suggested AI Worker Breakdown

```text
ai-worker/app/modules/content_parsing/
  base/
    schemas.py
    evidence.py
    normalizers.py
  image/
    recognition.py
    quality.py
    ocr.py
    composition.py
  video/
    metadata.py
    keyframes.py
    segmentation.py
    subtitles.py
    topic.py
  audio/
    transcription.py
    quality.py
    fluency.py
    emotion.py
  text/
    extraction.py
    keywords.py
    structure.py
    logic.py
  archive/
    unpack.py
    classify.py
  fusion/
    align.py
    correlate.py
    aggregate.py
  pipelines/
    image_pipeline.py
    video_pipeline.py
    audio_pipeline.py
    text_pipeline.py
    archive_pipeline.py
    multimodal_pipeline.py
```

## Dependencies On Other Modules

### Upstream

- assignment management provides uploaded files, version links, student context, class context, and batch membership

### Downstream

- intelligent evaluation consumes structured features and evidence mappings
- result feedback consumes parsed evidence and reviewable context for explanations and traceability

## Deferred Implementation Notes

This document captures the detailed target scope only. The current repository still treats multimodal parsing as a future AI-enabled module.

The current codebase now reserves the first integration contracts in the AI Worker:

- provider configuration loader in `ai-worker/app/config.py`
- provider registry in `ai-worker/app/providers/`
- OpenAI-compatible client adapter in `ai-worker/app/providers/openai_compatible.py`
- parsing request/response schemas in `ai-worker/app/modules/content_parsing/base/schemas.py`
- placeholder API surface in `ai-worker/app/modules/content_parsing/router.py`
- placeholder per-modality pipelines in `ai-worker/app/modules/content_parsing/pipelines/`

These pieces are intentionally contract-only. They should let the backend integrate with:

- provider capability discovery
- parse task submission
- file-level planned artifact expectations
- future multimodal association outputs

without forcing an early commitment to a specific model vendor or local runtime.

Before implementation begins, the next design step should define:

1. first-phase file formats
2. unified parsing result schema
3. queue/job protocol between backend and AI Worker
4. local model vs cloud API strategy
5. fallback behavior for unsupported or partially parseable files
