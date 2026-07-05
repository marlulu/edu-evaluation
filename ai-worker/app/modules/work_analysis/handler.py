"""视频分析核心处理器"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from app.config import WorkerSettings, get_settings
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.providers.base import ProviderDescriptor, ProviderType

from .audio_analyzer import AudioFeatures, extract_audio, analyze_audio
from .ai_analyzer import (
    AnalysisResult,
    describe_keyframes_with_ai,
    analyze_comprehensive,
    evaluate_with_criteria,
)
from .criteria import get_default_criteria, parse_criteria_file
from .frame_extractor import Keyframe, extract_keyframes, extract_keyframes_ffmpeg, encode_image_base64
from .metadata import VideoMetadata, extract_metadata
from .ocr import ocr_keyframes
from .schemas import (
    AudioAnalysis,
    AudioGuidanceRequest,
    AudioGuidanceResult,
    AudioSegment,
    ContentAnalysis,
    EvaluationResult,
    GuidanceContent,
    KeyframeInfo,
    ScoreItem,
    TechnicalQuality,
    WorkAnalysisOptions,
    WorkAnalysisProgress,
    WorkAnalysisRequest,
    WorkAnalysisResult,
    VideoMetadata as VideoMetadataSchema,
    VideoTaskStatus,
)
from .transcriber import (
    TranscriptionResult,
    transcribe_with_whisper_api,
    transcribe_with_local_whisper,
    transcribe_with_faster_whisper,
    build_speech_analysis,
)

logger = logging.getLogger(__name__)


class VideoAnalyzer:
    """视频分析器"""

    def __init__(
        self,
        settings: WorkerSettings | None = None,
        vision_provider: OpenAICompatibleProvider | None = None,
        speech_provider: OpenAICompatibleProvider | None = None,
        text_provider: OpenAICompatibleProvider | None = None,
    ):
        self.settings = settings or get_settings()
        self.vision_provider = vision_provider
        self.speech_provider = speech_provider
        self.text_provider = text_provider

        # 临时目录
        self.temp_dir = Path(tempfile.mkdtemp(prefix="work_analysis_"))

        # MinIO 客户端
        self._minio_client = None
        if self.settings.minio_endpoint and self.settings.minio_access_key and self.settings.minio_secret_key:
            try:
                from minio import Minio
                endpoint = self.settings.minio_endpoint.replace("http://", "").replace("https://", "")
                self._minio_client = Minio(
                    endpoint,
                    access_key=self.settings.minio_access_key,
                    secret_key=self.settings.minio_secret_key,
                    secure=self.settings.minio_secure,
                )
            except Exception as e:
                logger.warning("Failed to initialize MinIO client: %s", e)

    async def analyze(
        self,
        request: WorkAnalysisRequest,
        progress_callback: Callable[[WorkAnalysisProgress], None] | None = None,
    ) -> WorkAnalysisResult:
        """执行视频分析"""
        task_id = request.task_id
        started_at = datetime.now(timezone.utc)

        def update_progress(status: VideoTaskStatus, progress: float, detail: str = ""):
            if progress_callback:
                progress_callback(WorkAnalysisProgress(
                    task_id=task_id,
                    status=status,
                    progress=progress,
                    current_stage=status.value,
                    detail=detail,
                ))

        try:
            # 初始化结果
            result = WorkAnalysisResult(
                task_id=task_id,
                file_name=request.file_name,
                status=VideoTaskStatus.PREPROCESSING,
                started_at=started_at.isoformat(),
            )

            # 1. 提取元数据
            update_progress(VideoTaskStatus.EXTRACTING_METADATA, 10, "提取视频元数据")
            metadata = extract_metadata(request.file_path)
            result.metadata = VideoMetadataSchema(
                duration_seconds=metadata.duration,
                width=metadata.width,
                height=metadata.height,
                fps=metadata.fps,
                codec=metadata.work_codec,
                bitrate=0,
                file_size=metadata.file_size,
                format_name=metadata.format_name,
                has_audio=metadata.audio_codec != "unknown",
                audio_codec=metadata.audio_codec,
                audio_sample_rate=metadata.sample_rate,
            )

            # 检查视频时长限制
            if metadata.duration > 30 * 60:
                result.warnings.append("视频超过30分钟，仅分析前30分钟")

            # 2. 提取关键帧
            keyframes_dir = self.temp_dir / task_id / "keyframes"
            keyframes: list[Keyframe] = []

            if request.options.extract_keyframes:
                update_progress(VideoTaskStatus.EXTRACTING_KEYFRAMES, 25, "提取关键帧")

                method = request.options.keyframe_method.value if hasattr(request.options.keyframe_method, 'value') else str(request.options.keyframe_method)
                keyframes = extract_keyframes_ffmpeg(
                    request.file_path,
                    keyframes_dir,
                    method=method,
                    threshold=request.options.scene_threshold,
                    max_frames=request.options.max_keyframes,
                    interval=request.options.min_interval_seconds,
                )

                # 上传关键帧到 MinIO 或转换为 base64
                for kf in keyframes:
                    if kf.path and Path(kf.path).exists():
                        # 尝试上传到 MinIO
                        url = self._upload_to_minio(Path(kf.path), f"work-keyframes/{task_id}/frame_{kf.index:04d}.jpg")
                        if url:
                            kf.url = url  # 存储 MinIO URL，保留 kf.path 为本地路径
                        else:
                            # MinIO 上传失败，转换为 base64（带 data URI 前缀）
                            kf.image_base64 = "data:image/jpeg;base64," + encode_image_base64(kf.path)

                result.keyframes = [
                    KeyframeInfo(
                        frame_id=f"frame_{kf.index}",
                        timestamp_seconds=kf.timestamp,
                        frame_index=kf.index,
                        scene_change_score=kf.change_score,
                        image_path=kf.url,       # MinIO URL（前端展示用）
                        image_base64=kf.image_base64,
                    )
                    for kf in keyframes
                ]
                result.status = VideoTaskStatus.EXTRACTING_KEYFRAMES

            # 3. 提取和分析音频
            audio_path = None
            audio_features = None
            transcription = None

            if request.options.transcribe_audio and metadata.audio_codec != "unknown":
                update_progress(VideoTaskStatus.EXTRACTING_AUDIO, 40, "提取音频")
                audio_dir = self.temp_dir / task_id
                audio_path = extract_audio(request.file_path, audio_dir)

                update_progress(VideoTaskStatus.TRANSCRIBING, 50, "分析音频特征")
                audio_features = analyze_audio(audio_path, metadata.duration)

                # 语音转录
                update_progress(VideoTaskStatus.TRANSCRIBING, 55, "语音转录")
                # 优先使用本地 Whisper（已有缓存模型）
                transcription = transcribe_with_local_whisper(audio_path)
                if not transcription:
                    # 尝试 faster-whisper
                    transcription = transcribe_with_faster_whisper(audio_path)
                if not transcription:
                    # 尝试 Whisper API
                    if self.settings.model_api_key and self.settings.model_api_base_url:
                        transcription = transcribe_with_whisper_api(
                            audio_path,
                            self.settings.model_api_key,
                            self.settings.model_api_base_url,
                        )

                # 构建音频分析结果
                if transcription:
                    result.audio_analysis = AudioAnalysis(
                        transcription=[
                            AudioSegment(
                                start_time=seg.start_time,
                                end_time=seg.end_time,
                                text=seg.text,
                                confidence=seg.confidence,
                            )
                            for seg in transcription.segments
                        ],
                        total_speech_duration=audio_features.total_speech_duration if audio_features else 0,
                        average_speech_rate=transcription.speech_rate,
                        detected_language=transcription.language,
                    )
                else:
                    result.audio_analysis = AudioAnalysis(
                        transcription=[],
                        total_speech_duration=audio_features.total_speech_duration if audio_features else 0,
                        average_speech_rate=0,
                        detected_language="unknown",
                    )

                result.status = VideoTaskStatus.TRANSCRIBING

            # 4. OCR 关键帧
            if request.options.ocr_enabled and keyframes:
                update_progress(VideoTaskStatus.ANALYZING_CONTENT, 65, "OCR 文字识别")
                keyframes = ocr_keyframes(keyframes, use_paddle=True)

            # 5. AI 综合分析
            scene_description = ""
            if self.text_provider and keyframes:
                update_progress(VideoTaskStatus.ANALYZING_CONTENT, 70, "AI 画面分析")

                # 使用 vision provider 进行画面描述
                client = self.vision_provider.create_client() if self.vision_provider else self.text_provider.create_client()
                model = self.settings.vision_model_name or self.settings.text_model_name or "gpt-5.5"

                scene_description = describe_keyframes_with_ai(client, model, keyframes)

            # 6. AI 综合分析
            ai_analysis_text = ""
            if self.text_provider:
                update_progress(VideoTaskStatus.ANALYZING_CONTENT, 80, "AI 综合分析")

                client = self.text_provider.create_client()
                model = self.settings.text_model_name or "gpt-5.5"

                ai_analysis_text = analyze_comprehensive(
                    client,
                    model,
                    metadata,
                    audio_features,
                    transcription,
                    keyframes,
                    scene_description,
                )

                logger.info("AI analysis text length: %d chars", len(ai_analysis_text) if ai_analysis_text else 0)

                result.content_analysis = ContentAnalysis(
                    overall_topic="视频分析",
                    summary=ai_analysis_text if ai_analysis_text else "分析完成",
                    key_points=[],
                    keywords=[],
                )

            # 7. 评判标准评分（上传文件优先，否则使用默认标准）
            if self.text_provider and ai_analysis_text:
                update_progress(VideoTaskStatus.ANALYZING_CONTENT, 90, "评判标准评分")

                client = self.text_provider.create_client()
                model = self.settings.text_model_name or "gpt-5.5"

                criteria_text = request.criteria_text or get_default_criteria()
                logger.info("Using criteria: %s", "uploaded file" if request.criteria_text else "default")

                evaluation_data = evaluate_with_criteria(
                    client,
                    model,
                    ai_analysis_text,
                    criteria_text,
                )

                # 将评分结果存入 content_analysis.evaluation
                if result.content_analysis and isinstance(evaluation_data, dict):
                    try:
                        result.content_analysis.evaluation = EvaluationResult(
                            total_score=evaluation_data.get("total_score", 0),
                            grade=evaluation_data.get("grade", ""),
                            scores=[
                                ScoreItem(
                                    dimension=s.get("dimension", ""),
                                    max_score=s.get("max_score", 0),
                                    score=s.get("score", 0),
                                    evidence=s.get("evidence", ""),
                                    suggestion=s.get("suggestion", ""),
                                )
                                for s in evaluation_data.get("scores", [])
                            ],
                            strengths=evaluation_data.get("strengths", []),
                            weaknesses=evaluation_data.get("weaknesses", []),
                            priority_suggestions=evaluation_data.get("priority_suggestions", []),
                            criteria_text=evaluation_data.get("criteria_text", criteria_text),
                        )
                        logger.info("Evaluation stored: total_score=%.1f, grade=%s",
                                    result.content_analysis.evaluation.total_score,
                                    result.content_analysis.evaluation.grade)
                    except Exception as e:
                        logger.error("Failed to store evaluation result: %s", e)

            # 8. 技术质量评估
            result.technical_quality = self._assess_technical_quality(metadata, audio_features)

            # 9. 完成
            completed_at = datetime.now(timezone.utc)
            result.status = VideoTaskStatus.COMPLETED
            result.progress = 100
            result.completed_at = completed_at.isoformat()
            result.processing_time_ms = int((completed_at - started_at).total_seconds() * 1000)

            update_progress(VideoTaskStatus.COMPLETED, 100, "分析完成")

            # 清理音频文件
            if audio_path and Path(audio_path).exists():
                Path(audio_path).unlink(missing_ok=True)

            return result

        except Exception as e:
            logger.exception("Video analysis failed")
            result.status = VideoTaskStatus.FAILED
            result.error = str(e)
            result.completed_at = datetime.now(timezone.utc).isoformat()
            update_progress(VideoTaskStatus.FAILED, 0, f"处理失败: {e}")
            return result

    def _assess_technical_quality(
        self,
        metadata: VideoMetadata,
        audio_features: AudioFeatures | None,
    ) -> TechnicalQuality:
        """评估技术质量"""
        # 视频质量评估
        if metadata.height >= 1080:
            work_quality = "高清"
        elif metadata.height >= 720:
            work_quality = "标清"
        else:
            work_quality = "低清"

        # 音频质量评估
        if audio_features:
            mean_vol = audio_features.mean_volume
            if -20 <= mean_vol <= -10:
                audio_quality = "清晰"
            elif -30 <= mean_vol < -20 or -10 < mean_vol <= -5:
                audio_quality = "一般"
            else:
                audio_quality = "较差"
        else:
            audio_quality = "未知"

        # 稳定性评估（基于帧率）
        if metadata.fps >= 24:
            stability = "稳定"
        elif metadata.fps >= 15:
            stability = "轻微抖动"
        else:
            stability = "严重抖动"

        # 综合评分
        score = 0
        if metadata.height >= 1080:
            score += 40
        elif metadata.height >= 720:
            score += 30
        else:
            score += 20

        if metadata.fps >= 24:
            score += 30
        elif metadata.fps >= 15:
            score += 20
        else:
            score += 10

        if audio_features and -20 <= audio_features.mean_volume <= -10:
            score += 30
        elif audio_features:
            score += 20
        else:
            score += 10

        return TechnicalQuality(
            work_quality=work_quality,
            audio_quality=audio_quality,
            stability=stability,
            overall_score=score,
        )

    def _upload_to_minio(self, file_path: Path, object_name: str) -> str | None:
        """上传文件到 MinIO 并返回访问 URL"""
        if not self._minio_client:
            return None

        try:
            bucket = self.settings.minio_bucket
            if not self._minio_client.bucket_exists(bucket):
                self._minio_client.make_bucket(bucket)

            self._minio_client.fput_object(
                bucket,
                object_name,
                str(file_path),
                content_type="image/jpeg",
            )

            protocol = "https" if self.settings.minio_secure else "http"
            endpoint = self.settings.minio_endpoint.replace("http://", "").replace("https://", "")
            return f"{protocol}://{endpoint}/{bucket}/{object_name}"
        except Exception as e:
            logger.warning("Failed to upload to MinIO: %s", e)
            return None

    def cleanup(self):
        """清理临时文件"""
        import shutil
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)


# 任务管理器
class WorkAnalysisManager:
    """视频分析任务管理器"""

    def __init__(self):
        self.tasks: dict[str, WorkAnalysisResult] = {}
        self.audio_guidance_tasks: dict[str, AudioGuidanceResult] = {}
        self.analyzer: VideoAnalyzer | None = None

    def get_analyzer(self) -> VideoAnalyzer:
        """获取分析器实例"""
        if not self.analyzer:
            settings = get_settings()

            vision_provider = self._create_provider(settings, ProviderType.VISION, "vision")
            speech_provider = self._create_provider(settings, ProviderType.SPEECH, "speech")
            text_provider = self._create_provider(settings, ProviderType.TEXT, "text")

            self.analyzer = VideoAnalyzer(
                settings=settings,
                vision_provider=vision_provider,
                speech_provider=speech_provider,
                text_provider=text_provider,
            )
        return self.analyzer

    def _create_provider(
        self,
        settings: WorkerSettings,
        provider_type: ProviderType,
        provider_name: str,
    ) -> OpenAICompatibleProvider | None:
        """根据配置创建 provider"""
        if not settings.model_api_base_url or not settings.model_api_key:
            return None

        descriptor = ProviderDescriptor(
            provider_type=provider_type,
            provider_name=f"{provider_name}-provider",
            model_name=self._get_model_name(settings, provider_type),
            base_url=settings.model_api_base_url,
            configured=True,
            required_env_keys=[],
            configured_env_keys=[],
            note=f"{provider_name} model provider",
        )

        return OpenAICompatibleProvider(descriptor, settings)

    def _get_model_name(self, settings: WorkerSettings, provider_type: ProviderType) -> str | None:
        """获取模型名称"""
        model_map = {
            ProviderType.VISION: settings.vision_model_name,
            ProviderType.SPEECH: settings.audio_model_name,
            ProviderType.TEXT: settings.text_model_name,
            ProviderType.MULTIMODAL: settings.multimodal_model_name,
            ProviderType.OCR: settings.ocr_model_name,
            ProviderType.ASR: settings.asr_model_name,
        }
        return model_map.get(provider_type)

    async def submit_task(self, request: WorkAnalysisRequest) -> str:
        """提交分析任务"""
        task_id = request.task_id

        self.tasks[task_id] = WorkAnalysisResult(
            task_id=task_id,
            file_name=request.file_name,
            status=VideoTaskStatus.PENDING,
            progress=0,
        )

        asyncio.create_task(self._execute_task(request))
        return task_id

    async def _execute_task(self, request: WorkAnalysisRequest):
        """执行分析任务"""
        task_id = request.task_id
        analyzer = self.get_analyzer()

        def progress_callback(progress: WorkAnalysisProgress):
            if task_id in self.tasks:
                self.tasks[task_id].status = progress.status
                self.tasks[task_id].progress = progress.progress

        try:
            result = await analyzer.analyze(request, progress_callback)
            self.tasks[task_id] = result
        except Exception as e:
            self.tasks[task_id].status = VideoTaskStatus.FAILED
            self.tasks[task_id].error = str(e)

    def get_task(self, task_id: str) -> WorkAnalysisResult | None:
        """获取任务状态"""
        return self.tasks.get(task_id)

    def list_tasks(self) -> list[dict]:
        """列出所有任务"""
        return [
            {
                "task_id": task.task_id,
                "file_name": task.file_name,
                "status": task.status,
                "progress": task.progress,
            }
            for task in self.tasks.values()
        ]


# 全局实例
work_manager = WorkAnalysisManager()
