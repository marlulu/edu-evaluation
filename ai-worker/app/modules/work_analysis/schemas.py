"""视频分析的数据模型"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class VideoTaskStatus(str, Enum):
    """视频分析任务状态"""
    PENDING = "pending"
    PREPROCESSING = "preprocessing"
    EXTRACTING_METADATA = "extracting_metadata"
    EXTRACTING_KEYFRAMES = "extracting_keyframes"
    EXTRACTING_AUDIO = "extracting_audio"
    TRANSCRIBING = "transcribing"
    ANALYZING_CONTENT = "analyzing_content"
    COMPLETED = "completed"
    FAILED = "failed"


class KeyframeMethod(str, Enum):
    """关键帧提取方法"""
    INTERVAL = "interval"
    SCENE_CHANGE = "scene_change"
    HYBRID = "hybrid"


class WorkAnalysisOptions(BaseModel):
    """视频分析选项"""
    extract_keyframes: bool = Field(default=True, alias="extractKeyframes")
    keyframe_method: KeyframeMethod = Field(default=KeyframeMethod.HYBRID, alias="keyframeMethod")
    max_keyframes: int = Field(default=50, ge=1, le=100, alias="maxKeyframes")
    scene_threshold: float = Field(default=0.3, ge=0.1, le=0.9, alias="sceneThreshold")
    min_interval_seconds: float = Field(default=5.0, ge=1.0, le=30.0, alias="minIntervalSeconds")
    transcribe_audio: bool = Field(default=True, alias="transcribeAudio")
    whisper_language: str | None = Field(default=None, alias="whisperLanguage")
    analyze_content: bool = Field(default=True, alias="analyzeContent")
    ocr_enabled: bool = Field(default=True, alias="ocrEnabled")

    model_config = {"populate_by_name": True}


class VideoMetadata(BaseModel):
    """视频元数据"""
    duration_seconds: float
    width: int
    height: int
    fps: float
    codec: str
    bitrate: int
    file_size: int
    format_name: str
    has_audio: bool
    audio_codec: str | None = None
    audio_sample_rate: int | None = None


class KeyframeInfo(BaseModel):
    """关键帧信息"""
    frame_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp_seconds: float
    frame_index: int
    scene_change_score: float | None = None
    image_path: str | None = None
    image_base64: str | None = None


class AudioSegment(BaseModel):
    """音频片段（转录结果）"""
    start_time: float
    end_time: float
    text: str
    confidence: float | None = None
    speaker_id: str | None = None


class AudioAnalysis(BaseModel):
    """音频分析结果"""
    transcription: list[AudioSegment]
    total_speech_duration: float
    average_speech_rate: float  # 字/分钟
    detected_language: str
    clarity_score: float | None = None


class VideoScene(BaseModel):
    """视频场景"""
    start_time: float
    end_time: float
    description: str
    keyframe_ids: list[str] = Field(default_factory=list)
    scene_type: str | None = None  # "presentation" | "demo" | "talking_head" etc.


class ScoreItem(BaseModel):
    """单个维度的评分结果"""
    dimension: str         # 维度名称
    max_score: float       # 满分
    score: float           # 得分
    evidence: str = ""     # 评分依据
    suggestion: str = ""   # 改进建议


class EvaluationResult(BaseModel):
    """完整评估结果"""
    total_score: float                         # 总分（0-100）
    grade: str = ""                            # 等级（优秀/良好/合格/不合格）
    scores: list[ScoreItem] = []               # 各维度得分
    strengths: list[str] = []                  # 优点
    weaknesses: list[str] = []                 # 不足
    priority_suggestions: list[str] = []       # 优先改进建议
    criteria_text: str = ""                    # 使用的评分标准原文


class ContentAnalysis(BaseModel):
    """内容分析结果"""
    overall_topic: str
    summary: str
    key_points: list[str]
    scenes: list[VideoScene] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    evaluation: EvaluationResult | None = None  # 基于评分标准的打分结果


class TechnicalQuality(BaseModel):
    """技术质量指标"""
    work_quality: str  # "高清" | "标清" | "低清"
    audio_quality: str  # "清晰" | "一般" | "较差"
    stability: str  # "稳定" | "轻微抖动" | "严重抖动"
    overall_score: float  # 0-100


class WorkAnalysisResult(BaseModel):
    """作品分析结果"""
    task_id: str
    file_name: str
    file_type: str | None = None  # "video", "audio", "document"
    status: VideoTaskStatus

    # 元数据
    metadata: VideoMetadata | None = None

    # 关键帧
    keyframes: list[KeyframeInfo] = Field(default_factory=list)

    # 音频分析
    audio_analysis: AudioAnalysis | None = None

    # 内容分析
    content_analysis: ContentAnalysis | None = None

    # 质量指标
    technical_quality: TechnicalQuality | None = None

    # 处理信息
    progress: float = 0
    started_at: str | None = None
    completed_at: str | None = None
    processing_time_ms: int | None = None
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)


class WorkAnalysisRequest(BaseModel):
    """视频分析请求"""
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    file_name: str
    file_path: str
    options: WorkAnalysisOptions = Field(default_factory=WorkAnalysisOptions)
    callback_url: str | None = None
    criteria_text: str | None = None

    model_config = {"populate_by_name": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        """兼容 camelCase 和 snake_case"""
        if isinstance(obj, dict):
            mapping = {
                "taskId": "task_id",
                "fileName": "file_name",
                "filePath": "file_path",
                "callbackUrl": "callback_url",
                "criteriaText": "criteria_text",
            }
            converted = {}
            for k, v in obj.items():
                new_key = mapping.get(k, k)
                if new_key == "options" and isinstance(v, dict):
                    converted[new_key] = WorkAnalysisOptions.model_validate(v)
                else:
                    converted[new_key] = v
            obj = converted
        return super().model_validate(obj, **kwargs)


class WorkAnalysisProgress(BaseModel):
    """视频分析进度"""
    task_id: str
    status: VideoTaskStatus
    progress: float
    current_stage: str
    detail: str | None = None
    updated_at: str = Field(default_factory=utc_now_iso)


# ====== 音频指导相关模型 ======

class AudioGuidanceType(str, Enum):
    """音频指导类型"""
    GENERAL = "general"  # 通用指导
    SPEECH = "speech"  # 演讲评价
    PRESENTATION = "presentation"  # 演示/报告评价
    READING = "reading"  # 朗读评价
    CUSTOM = "custom"  # 自定义评价


class AudioGuidanceRequest(BaseModel):
    """音频指导请求"""
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    audio_path: str  # 音频/视频文件路径
    language: str | None = None  # 语言提示（None=自动检测）
    guidance_type: AudioGuidanceType = AudioGuidanceType.CUSTOM  # 指导类型
    custom_prompt: str | None = None  # 自定义指导提示（guidance_type=custom时推荐提供）
    evaluation_dimensions: list[str] | None = None  # 自定义评价维度列表
    output_format: str = "structured"  # 输出格式：structured/freeform


class DimensionEvaluation(BaseModel):
    """维度评价"""
    dimension_name: str  # 维度名称
    score: float  # 评分（0-100）
    feedback: str  # 该维度的反馈


class GuidanceContent(BaseModel):
    """指导内容"""
    summary: str  # 总体评价
    strengths: list[str]  # 优点
    weaknesses: list[str]  # 不足
    suggestions: list[str]  # 改进建议
    detailed_feedback: str  # 详细反馈
    score: float | None = None  # 综合评分（0-100）
    dimension_evaluations: list[DimensionEvaluation] | None = None  # 自定义维度评价


class AudioGuidanceResult(BaseModel):
    """音频指导结果"""
    task_id: str
    file_name: str
    status: VideoTaskStatus

    # 转录结果
    audio_analysis: AudioAnalysis | None = None

    # 指导内容
    guidance: GuidanceContent | None = None

    # 处理信息
    progress: float = 0
    started_at: str | None = None
    completed_at: str | None = None
    processing_time_ms: int | None = None
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)
