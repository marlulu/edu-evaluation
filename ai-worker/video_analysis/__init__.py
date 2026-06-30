"""
视频分析模块

提供完整的视频分析流程：元数据提取、音频分析、关键帧提取、OCR、AI综合分析、评判标准评分。

使用方式：

    # 命令行
    python -m video_analysis video.mp4 -T work -c criteria.docx

    # 代码调用
    from video_analysis import analyze_video
    result = analyze_video("video.mp4", video_type="work")
"""

from .cli import run_analysis as analyze_video
from .metadata import extract_metadata
from .audio import extract_audio, analyze_audio
from .frames import extract_keyframes
from .ocr import ocr_keyframes
from .transcription import transcribe_audio
from .ai_analyzer import describe_all_frames_with_ai, analyze_with_ai, evaluate_with_criteria
from .criteria import parse_criteria_file, get_default_criteria

__all__ = [
    "analyze_video",
    "extract_metadata",
    "extract_audio",
    "analyze_audio",
    "extract_keyframes",
    "ocr_keyframes",
    "transcribe_audio",
    "describe_all_frames_with_ai",
    "analyze_with_ai",
    "evaluate_with_criteria",
    "parse_criteria_file",
    "get_default_criteria",
]
