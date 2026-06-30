"""音频提取与分析"""

import subprocess
from pathlib import Path


def extract_audio(video_path: str) -> str:
    """提取音频为 WAV"""
    audio_path = str(Path(video_path).with_suffix(".wav"))
    subprocess.run(
        ["ffmpeg", "-i", video_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", audio_path, "-y"],
        capture_output=True, timeout=120,
    )
    return audio_path


def analyze_audio(audio_path: str) -> dict:
    """分析音频特征（音量、静音段）"""
    result = {"volume": {}, "silence": []}

    # 音量分析
    cmd = ["ffmpeg", "-i", audio_path, "-af", "volumedetect", "-f", "null", "-"]
    vol_result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=120)
    for line in vol_result.stderr.split("\n"):
        if "mean_volume" in line:
            result["volume"]["mean"] = float(line.split("mean_volume:")[1].strip().replace(" dB", ""))
        elif "max_volume" in line:
            result["volume"]["max"] = float(line.split("max_volume:")[1].strip().replace(" dB", ""))

    # 静音检测
    cmd = ["ffmpeg", "-i", audio_path, "-af", "silencedetect=noise=-30dB:d=0.5", "-f", "null", "-"]
    sil_result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=120)
    current_start = None
    for line in sil_result.stderr.split("\n"):
        if "silence_start:" in line:
            current_start = float(line.split("silence_start:")[1].strip())
        elif "silence_end:" in line and current_start is not None:
            parts = line.split("silence_end:")[1].strip().split()
            end = float(parts[0])
            result["silence"].append({"start": round(current_start, 2), "end": round(end, 2)})
            current_start = None

    return result
