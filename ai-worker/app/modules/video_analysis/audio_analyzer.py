"""音频提取与分析"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class SilenceSegment:
    """静音段"""
    start: float
    end: float

    @property
    def duration(self) -> float:
        return self.end - self.start


@dataclass
class AudioFeatures:
    """音频特征"""
    mean_volume: float = -20.0
    max_volume: float = -10.0
    silence_segments: list[SilenceSegment] = field(default_factory=list)
    total_speech_duration: float = 0.0
    speech_ratio: float = 0.0
    short_pauses: int = 0
    long_pauses: int = 0


def extract_audio(video_path: str, output_dir: Path | None = None) -> str:
    """提取音频为 WAV"""
    if output_dir:
        audio_path = str(output_dir / "audio.wav")
    else:
        audio_path = str(Path(video_path).with_suffix(".wav"))

    subprocess.run(
        [
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le",
            "-ar", "16000", "-ac", "1",
            audio_path, "-y",
        ],
        capture_output=True,
        timeout=120,
    )
    return audio_path


def analyze_audio(audio_path: str, total_duration: float = 0.0) -> AudioFeatures:
    """分析音频特征（音量、静音段）"""
    features = AudioFeatures()

    # 音量分析
    cmd = ["ffmpeg", "-i", audio_path, "-af", "volumedetect", "-f", "null", "-"]
    vol_result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=120)
    for line in vol_result.stderr.split("\n"):
        if "mean_volume" in line:
            features.mean_volume = float(line.split("mean_volume:")[1].strip().replace(" dB", ""))
        elif "max_volume" in line:
            features.max_volume = float(line.split("max_volume:")[1].strip().replace(" dB", ""))

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
            features.silence_segments.append(SilenceSegment(start=round(current_start, 2), end=round(end, 2)))
            current_start = None

    # 计算统计信息
    silence_duration = sum(s.duration for s in features.silence_segments)
    if total_duration > 0:
        features.total_speech_duration = total_duration - silence_duration
        features.speech_ratio = features.total_speech_duration / total_duration

    features.short_pauses = sum(1 for s in features.silence_segments if 0.5 <= s.duration <= 2)
    features.long_pauses = sum(1 for s in features.silence_segments if s.duration > 2)

    return features
