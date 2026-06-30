"""关键帧提取与差异计算"""

from __future__ import annotations

import base64
import subprocess
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Keyframe:
    """关键帧信息"""
    index: int
    timestamp: float
    path: str | None = None          # 始终保留本地临时文件路径
    url: str | None = None           # MinIO 上传后的远程 URL
    image_base64: str | None = None
    change_score: float | None = None
    ocr_texts: list[dict] = field(default_factory=list)
    ocr_summary: str = ""
    scene_description: str = ""


def encode_image_base64(image_path: str) -> str:
    """将图片编码为 base64"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_all_frames(
    video_path: str,
    output_dir: Path,
    interval: float = 2.0,
    max_frames: int = 30,
) -> list[Keyframe]:
    """按间隔提取所有帧"""
    output_dir.mkdir(parents=True, exist_ok=True)

    # 获取视频时长
    import json
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", video_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    duration = float(json.loads(result.stdout).get("format", {}).get("duration", 0))

    frames = []
    timestamp = 0
    index = 0

    while timestamp < duration and index < max_frames:
        output_path = output_dir / f"frame_{index:04d}.jpg"
        cmd = [
            "ffmpeg", "-ss", str(timestamp), "-i", video_path,
            "-vframes", "1", "-q:v", "2", str(output_path), "-y",
        ]
        subprocess.run(cmd, capture_output=True, timeout=10)
        if output_path.exists():
            frames.append(Keyframe(
                index=index,
                timestamp=round(timestamp, 2),
                path=str(output_path),
            ))
        timestamp += interval
        index += 1

    return frames


def calculate_frame_difference(img_path1: str, img_path2: str) -> float:
    """计算两帧图片的差异程度"""
    try:
        from PIL import Image
        import numpy as np

        img1 = Image.open(img_path1).convert("L").resize((160, 90))
        img2 = Image.open(img_path2).convert("L").resize((160, 90))

        arr1 = np.array(img1, dtype=np.float32)
        arr2 = np.array(img2, dtype=np.float32)

        diff = np.abs(arr1 - arr2)
        mean_diff = np.mean(diff) / 255.0

        def edges(arr):
            gx = np.abs(np.diff(arr, axis=1))
            gy = np.abs(np.diff(arr, axis=0))
            return gx[:gy.shape[0], :gx.shape[1]]

        edge1 = edges(arr1)
        edge2 = edges(arr2)
        edge_diff = np.mean(np.abs(edge1 - edge2)) / 255.0

        return round(mean_diff * 0.6 + edge_diff * 0.4, 4)
    except ImportError:
        # 如果没有 PIL/numpy，使用 ffmpeg 场景检测
        return 0.0


def extract_keyframes(
    video_path: str,
    output_dir: Path,
    threshold: float = 0.08,
    max_frames: int = 15,
    interval: float = 2.0,
) -> list[Keyframe]:
    """基于画面变化提取关键帧"""
    all_frames = extract_all_frames(video_path, output_dir, interval, max_frames * 3)

    if len(all_frames) < 2:
        return all_frames

    keyframes = [all_frames[0]]

    for i in range(1, len(all_frames)):
        if all_frames[i].path and all_frames[i - 1].path:
            change = calculate_frame_difference(all_frames[i - 1].path, all_frames[i].path)
            if change >= threshold:
                all_frames[i].change_score = change
                keyframes.append(all_frames[i])

        if len(keyframes) >= max_frames:
            break

    return keyframes[:max_frames]


def extract_keyframes_ffmpeg(
    video_path: str,
    output_dir: Path,
    method: str = "hybrid",
    threshold: float = 0.3,
    max_frames: int = 15,
    interval: float = 5.0,
) -> list[Keyframe]:
    """使用 ffmpeg 提取关键帧（支持多种方法）"""
    output_dir.mkdir(parents=True, exist_ok=True)
    keyframes = []

    if method == "interval":
        keyframes = _extract_by_interval(video_path, output_dir, interval, max_frames)
    elif method == "scene_change":
        keyframes = _extract_by_scene_change(video_path, output_dir, threshold, max_frames)
    else:  # hybrid
        scene_frames = _extract_by_scene_change(video_path, output_dir, threshold, max_frames)
        # 如果场景变化帧不够，用间隔提取补充
        if len(scene_frames) < max_frames:
            interval_frames = _extract_by_interval(
                video_path, output_dir, interval, max_frames
            )
            keyframes = _merge_keyframes(scene_frames, interval_frames)[:max_frames]
        else:
            keyframes = scene_frames[:max_frames]

    return keyframes


def _extract_by_interval(
    video_path: str,
    output_dir: Path,
    interval: float,
    max_frames: int,
) -> list[Keyframe]:
    """按间隔提取关键帧"""
    import json

    # 获取视频时长
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", video_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    duration = float(json.loads(result.stdout).get("format", {}).get("duration", 0))

    keyframes = []
    for i in range(max_frames):
        timestamp = i * interval
        if timestamp >= duration:
            break

        output_path = output_dir / f"frame_{i:04d}.jpg"
        cmd = [
            "ffmpeg", "-ss", str(timestamp), "-i", video_path,
            "-vframes", "1", "-q:v", "2", str(output_path), "-y",
        ]
        subprocess.run(cmd, capture_output=True, timeout=10)

        if output_path.exists():
            keyframes.append(Keyframe(
                index=i,
                timestamp=round(timestamp, 2),
                path=str(output_path),
            ))

    return keyframes


def _extract_by_scene_change(
    video_path: str,
    output_dir: Path,
    threshold: float,
    max_frames: int,
) -> list[Keyframe]:
    """基于场景变化提取关键帧"""
    import re

    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr",
        "-frames:v", str(max_frames),
        str(output_dir / "scene_%04d.jpg"),
        "-y",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    timestamps = re.findall(r"pts_time:(\d+\.?\d*)", result.stderr)

    keyframes = []
    for i, ts in enumerate(sorted(timestamps, key=float)):
        output_path = output_dir / f"scene_{i:04d}.jpg"
        if output_path.exists():
            keyframes.append(Keyframe(
                index=i,
                timestamp=float(ts),
                path=str(output_path),
                change_score=threshold,
            ))

    return keyframes


def _merge_keyframes(
    frames1: list[Keyframe],
    frames2: list[Keyframe],
    merge_threshold: float = 2.0,
) -> list[Keyframe]:
    """合并关键帧列表，去重"""
    merged = list(frames1)
    existing_timestamps = {f.timestamp for f in frames1}

    for frame in frames2:
        too_close = any(
            abs(ts - frame.timestamp) < merge_threshold
            for ts in existing_timestamps
        )
        if not too_close:
            merged.append(frame)
            existing_timestamps.add(frame.timestamp)

    return sorted(merged, key=lambda f: f.timestamp)
