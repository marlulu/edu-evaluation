"""视频元数据提取"""

import json
import subprocess


def extract_metadata(video_path: str) -> dict:
    """提取视频元数据"""
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", video_path]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=30)
    data = json.loads(result.stdout)

    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
    audio = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
    fmt = data.get("format", {})

    fps = 0
    if "r_frame_rate" in video:
        try:
            n, d = video["r_frame_rate"].split("/")
            fps = float(n) / float(d)
        except Exception:
            pass

    return {
        "duration": float(fmt.get("duration", 0)),
        "size_mb": round(int(fmt.get("size", 0)) / 1024 / 1024, 2),
        "width": int(video.get("width", 0)),
        "height": int(video.get("height", 0)),
        "fps": round(fps, 2),
        "video_codec": video.get("codec_name", "unknown"),
        "audio_codec": audio.get("codec_name", "unknown"),
        "sample_rate": int(audio.get("sample_rate", 0)),
        "channels": int(audio.get("channels", 0)),
    }
