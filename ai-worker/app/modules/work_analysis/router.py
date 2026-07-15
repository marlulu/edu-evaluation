"""作品分析 API 路由"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)

from app.config import WorkerSettings, get_settings
from app.modules.work_analysis.handler import work_manager
from app.modules.work_analysis.schemas import (
    AudioGuidanceRequest,
    AudioGuidanceResult,
    WorkAnalysisOptions,
    WorkAnalysisProgress,
    WorkAnalysisRequest,
    WorkAnalysisResult,
)
from app.providers import ProviderRegistry

router = APIRouter(prefix="/work", tags=["work-analysis"])


@router.post("/analyze", response_model=WorkAnalysisResult)
async def analyze_work(
    request: dict[str, Any],
) -> WorkAnalysisResult:
    """提交视频分析任务

    支持的功能：
    - 视频元数据提取
    - 关键帧提取（间隔/场景变化/混合）
    - 语音识别（Whisper）
    - 内容分析（AI 模型）
    - 技术质量评估
    """
    # 兼容 camelCase 和 snake_case
    mapping = {
        "taskId": "task_id",
        "fileName": "file_name",
        "filePath": "file_path",
        "imagePaths": "image_paths",
        "callbackUrl": "callback_url",
        "criteriaText": "criteria_text",
        "supportingDocumentName": "supporting_document_name",
        "supportingDocumentText": "supporting_document_text",
    }
    converted = {}
    for k, v in request.items():
        new_key = mapping.get(k, k)
        if new_key == "options" and isinstance(v, dict):
            options_mapping = {
                "extractKeyframes": "extract_keyframes",
                "keyframeMethod": "keyframe_method",
                "maxKeyframes": "max_keyframes",
                "sceneThreshold": "scene_threshold",
                "minIntervalSeconds": "min_interval_seconds",
                "transcribeAudio": "transcribe_audio",
                "whisperLanguage": "whisper_language",
                "analyzeContent": "analyze_content",
                "ocrEnabled": "ocr_enabled",
            }
            converted[new_key] = {options_mapping.get(ok, ok): ov for ok, ov in v.items()}
        else:
            converted[new_key] = v

    work_request = WorkAnalysisRequest(**converted)

    # 验证文件存在
    import os
    if not os.path.exists(work_request.file_path):
        raise HTTPException(status_code=400, detail=f"文件不存在: {work_request.file_path}")

    # 提交任务
    task_id = await work_manager.submit_task(work_request)

    # 等待任务完成（简化实现，实际应该异步）
    import asyncio
    for _ in range(300):  # 最多等待 5 分钟
        await asyncio.sleep(1)
        result = work_manager.get_task(task_id)
        if result and result.status.value in ["completed", "failed"]:
            return result

    # 超时返回当前状态
    result = work_manager.get_task(task_id)
    if result:
        return result

    raise HTTPException(status_code=500, detail="任务处理超时")


@router.post("/analyze/async")
async def analyze_work_async(
    request: dict[str, Any],
) -> dict[str, Any]:
    """异步提交视频分析任务

    立即返回任务 ID，通过 /work/tasks/{task_id} 查询进度
    """
    # 兼容 camelCase 和 snake_case
    mapping = {
        "taskId": "task_id",
        "fileName": "file_name",
        "filePath": "file_path",
        "imagePaths": "image_paths",
        "callbackUrl": "callback_url",
        "criteriaText": "criteria_text",
        "supportingDocumentName": "supporting_document_name",
        "supportingDocumentText": "supporting_document_text",
    }
    converted = {}
    for k, v in request.items():
        new_key = mapping.get(k, k)
        if new_key == "options" and isinstance(v, dict):
            options_mapping = {
                "extractKeyframes": "extract_keyframes",
                "keyframeMethod": "keyframe_method",
                "maxKeyframes": "max_keyframes",
                "sceneThreshold": "scene_threshold",
                "minIntervalSeconds": "min_interval_seconds",
                "transcribeAudio": "transcribe_audio",
                "whisperLanguage": "whisper_language",
                "analyzeContent": "analyze_content",
                "ocrEnabled": "ocr_enabled",
            }
            converted[new_key] = {options_mapping.get(ok, ok): ov for ok, ov in v.items()}
        else:
            converted[new_key] = v

    work_request = WorkAnalysisRequest(**converted)

    import os
    if not os.path.exists(work_request.file_path):
        raise HTTPException(status_code=400, detail=f"文件不存在: {work_request.file_path}")

    task_id = await work_manager.submit_task(work_request)

    return {
        "task_id": task_id,
        "status": "submitted",
        "message": "任务已提交，请通过 /work/tasks/{task_id} 查询进度",
    }


@router.get("/tasks/{task_id}", response_model=WorkAnalysisResult)
async def get_task_status(task_id: str) -> WorkAnalysisResult:
    """查询任务状态和结果"""
    result = work_manager.get_task(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在")
    return result


@router.get("/tasks/{task_id}/progress")
async def get_task_progress(task_id: str) -> dict[str, Any]:
    """查询任务进度"""
    result = work_manager.get_task(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在")

    return {
        "task_id": result.task_id,
        "status": result.status,
        "progress": result.progress,
        "current_stage": result.status.value,
    }


@router.get("/tasks")
async def list_tasks() -> dict[str, Any]:
    """列出所有任务"""
    tasks = work_manager.list_tasks()
    return {
        "total": len(tasks),
        "tasks": tasks,
    }


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str) -> dict[str, str]:
    """删除任务"""
    if task_id in work_manager.tasks:
        del work_manager.tasks[task_id]
        return {"message": "任务已删除", "task_id": task_id}
    raise HTTPException(status_code=404, detail="任务不存在")


@router.get("/capabilities")
async def get_capabilities() -> dict[str, Any]:
    """获取视频分析能力"""
    return {
        "supported_formats": ["mp4", "avi", "mov", "mkv", "webm"],
        "max_duration_seconds": 30 * 60,
        "max_file_size_mb": 500,
        "features": {
            "metadata_extraction": True,
            "keyframe_extraction": {
                "methods": ["interval", "scene_change", "hybrid"],
                "default_method": "hybrid",
                "max_frames": 100,
            },
            "audio_transcription": {
                "enabled": True,
                "languages": ["zh", "en"],
                "auto_detect": True,
            },
            "content_analysis": {
                "enabled": True,
                "topic_recognition": True,
                "keyword_extraction": True,
                "summarization": True,
            },
            "quality_assessment": {
                "work_quality": True,
                "audio_quality": True,
                "stability": True,
            },
        },
    }


@router.post("/parse-criteria")
async def parse_criteria(request: dict[str, Any]) -> dict[str, Any]:
    """解析评判标准文件

    支持的格式：PDF, Word (.docx), 文本 (.txt)
    返回解析后的文本内容
    """
    file_path = request.get("filePath") or request.get("file_path")
    if not file_path:
        raise HTTPException(status_code=400, detail="缺少文件路径参数")

    import os
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"文件不存在: {file_path}")

    from .criteria import parse_criteria_file as do_parse
    try:
        text = do_parse(file_path)
        logger.info("Parsed criteria file %s, text length: %d", file_path, len(text) if text else 0)
    except Exception as e:
        logger.error("Failed to parse criteria file %s: %s", file_path, e)
        raise HTTPException(status_code=500, detail=f"解析失败: {str(e)}")

    if not text:
        logger.warning("Parsed criteria file %s but got empty text", file_path)
        raise HTTPException(status_code=400, detail="无法解析文件内容")

    return {
        "success": True,
        "text": text,
        "filePath": file_path,
    }


# ====== 音频指导 API ======

@router.post("/audio/guidance", response_model=AudioGuidanceResult)
async def create_audio_guidance(
    request: AudioGuidanceRequest,
) -> AudioGuidanceResult:
    """传入音频文件，返回专业化指导

    支持的指导类型：
    - general: 通用指导
    - speech: 演讲评价
    - presentation: 演示/报告评价
    - reading: 朗读评价
    - custom: 自定义评价（需提供 custom_prompt）

    支持的音频格式：mp3, wav, m4a, flac, ogg, mp4, avi, mov 等
    """
    import os
    if not os.path.exists(request.audio_path):
        raise HTTPException(status_code=400, detail=f"文件不存在: {request.audio_path}")

    try:
        result = await work_manager.generate_audio_guidance(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.post("/audio/guidance/async")
async def create_audio_guidance_async(
    request: AudioGuidanceRequest,
) -> dict[str, Any]:
    """异步提交音频指导任务

    立即返回任务 ID，通过 /work/audio/guidance/tasks/{task_id} 查询结果
    """
    import os
    if not os.path.exists(request.audio_path):
        raise HTTPException(status_code=400, detail=f"文件不存在: {request.audio_path}")

    task_id = await work_manager.submit_audio_guidance_task(request)

    return {
        "task_id": task_id,
        "status": "submitted",
        "message": "任务已提交，请通过 /work/audio/guidance/tasks/{task_id} 查询结果",
    }


@router.get("/audio/guidance/tasks/{task_id}", response_model=AudioGuidanceResult)
async def get_audio_guidance_task(task_id: str) -> AudioGuidanceResult:
    """查询音频指导任务状态和结果"""
    result = work_manager.get_audio_guidance_task(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在")
    return result


@router.get("/audio/guidance/capabilities")
async def get_audio_guidance_capabilities() -> dict[str, Any]:
    """获取音频指导能力"""
    return {
        "supported_formats": ["mp3", "wav", "m4a", "flac", "ogg", "mp4", "avi", "mov", "mkv", "webm"],
        "max_duration_seconds": 30 * 60,
        "max_file_size_mb": 500,
        "guidance_types": [
            {
                "type": "general",
                "name": "通用指导",
                "description": "适用于大多数场景的通用内容分析",
            },
            {
                "type": "speech",
                "name": "演讲评价",
                "description": "重点评价表达技巧、逻辑结构、说服力",
            },
            {
                "type": "presentation",
                "name": "演示/报告评价",
                "description": "重点评价内容组织、专业性、清晰度",
            },
            {
                "type": "reading",
                "name": "朗读评价",
                "description": "重点评价发音准确度、流畅性、情感表达",
            },
            {
                "type": "custom",
                "name": "自定义评价",
                "description": "支持用户自定义评价维度和 prompt",
            },
        ],
        "features": {
            "transcription": True,
            "language_detection": True,
            "speech_rate_analysis": True,
            "clarity_assessment": True,
            "custom_dimensions": True,
        },
    }
