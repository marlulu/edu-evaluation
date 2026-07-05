"""视频元数据提取"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass


@dataclass
class VideoMetadata:
    """视频元数据"""
    duration: float
    width: int
    height: int
    fps: float
    work_codec: str
    audio_codec: str
    sample_rate: int
    channels: int
    file_size: int = 0
    format_name: str = ""


def extract_metadata(work_path: str) -> VideoMetadata:
    """提取视频元数据"""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        work_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=30)
    data = json.loads(result.stdout)

    work = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
    audio = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
    fmt = data.get("format", {})

    fps = 0
    if "r_frame_rate" in work:
        try:
            n, d = work["r_frame_rate"].split("/")
            fps = float(n) / float(d)
        except Exception:
            pass

    return VideoMetadata(
        duration=float(fmt.get("duration", 0)),
        width=int(work.get("width", 0)),
        height=int(work.get("height", 0)),
        fps=round(fps, 2),
        work_codec=work.get("codec_name", "unknown"),
        audio_codec=audio.get("codec_name", "unknown"),
        sample_rate=int(audio.get("sample_rate", 0)),
        channels=int(audio.get("channels", 0)),
        file_size=int(fmt.get("size", 0)),
        format_name=fmt.get("format_name", ""),
    )
