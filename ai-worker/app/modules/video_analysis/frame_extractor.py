"""关键帧提取与差异计算"""

from __future__ import annotations

import base64
import logging
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


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
    """
    计算两帧图片的差异程度（0-1）

    综合三种方法：
    1. 直方图差异 — 对光照变化鲁棒，反映整体内容变化
    2. 像素级差异 — 检测局部细节变化
    3. 边缘结构差异 — 对内容结构变化敏感
    """
    try:
        from PIL import Image
        import numpy as np

        size = (160, 90)
        img1 = Image.open(img_path1).convert("L").resize(size)
        img2 = Image.open(img_path2).convert("L").resize(size)

        arr1 = np.array(img1, dtype=np.float32)
        arr2 = np.array(img2, dtype=np.float32)

        # 1. 直方图差异（对光照变化鲁棒）
        hist1, _ = np.histogram(arr1, bins=64, range=(0, 256))
        hist2, _ = np.histogram(arr2, bins=64, range=(0, 256))
        hist1 = hist1 / max(hist1.sum(), 1)
        hist2 = hist2 / max(hist2.sum(), 1)
        hist_diff = float(np.sum(np.abs(hist1 - hist2)) / 2.0)

        # 2. 像素级平均差异
        pixel_diff = float(np.mean(np.abs(arr1 - arr2)) / 255.0)

        # 3. 边缘结构差异
        def edges(arr):
            gx = np.abs(np.diff(arr, axis=1))
            gy = np.abs(np.diff(arr, axis=0))
            return gx[:gy.shape[0], :gx.shape[1]]

        edge1 = edges(arr1)
        edge2 = edges(arr2)
        edge_diff = float(np.mean(np.abs(edge1 - edge2)) / 255.0)

        # 综合：直方图 0.3 + 像素 0.3 + 边缘 0.4
        return round(0.3 * hist_diff + 0.3 * pixel_diff + 0.4 * edge_diff, 4)
    except ImportError:
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
    threshold: float = 0.1,
    max_frames: int = 15,
    interval: float = 2.0,
) -> list[Keyframe]:
    """使用 ffmpeg 提取关键帧（支持多种方法）"""
    output_dir.mkdir(parents=True, exist_ok=True)
    keyframes = []

    if method == "interval":
        keyframes = _extract_by_interval(video_path, output_dir, interval, max_frames)
    elif method == "scene_change":
        keyframes = _extract_by_scene_change(video_path, output_dir, threshold, max_frames)
    else:  # hybrid
        # 优先使用场景变化检测，只提取变化明显的帧
        scene_frames = _extract_by_scene_change(video_path, output_dir, threshold, max_frames)
        logger.info(f"[Keyframe] scene_change={len(scene_frames)} (threshold={threshold})")

        # 如果场景变化帧不足，才补充间隔帧
        if len(scene_frames) < max_frames // 2:
            remaining = max_frames - len(scene_frames)
            interval_frames = _extract_by_interval(video_path, output_dir, interval, remaining)
            logger.info(f"[Keyframe] interval补充={len(interval_frames)} (interval={interval}s)")
            # 合并去重：用 1.0s 阈值避免重复帧
            keyframes = _merge_keyframes(scene_frames, interval_frames, 1.0)[:max_frames]
        else:
            keyframes = scene_frames[:max_frames]

        logger.info(f"[Keyframe] merged={len(keyframes)}")

    logger.info(f"[Keyframe] final: {len(keyframes)} keyframes (method={method}, max={max_frames})")
    return keyframes


def _extract_by_interval(
    video_path: str,
    output_dir: Path,
    interval: float,
    max_frames: int,
) -> list[Keyframe]:
    """按间隔提取关键帧（作为场景变化检测的补充）"""
    import json

    # 获取视频时长
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", video_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    duration = float(json.loads(result.stdout).get("format", {}).get("duration", 0))

    logger.info(f"[Keyframe] interval extraction: duration={duration:.1f}s, interval={interval}s, max={max_frames}")

    keyframes = []
    prev_path = None

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
            # 如果有前一帧，计算差异
            if prev_path and Path(prev_path).exists():
                change = calculate_frame_difference(prev_path, str(output_path))
                # 只保留变化明显的帧（阈值 0.1）
                if change < 0.1:
                    continue

            keyframes.append(Keyframe(
                index=i,
                timestamp=round(timestamp, 2),
                path=str(output_path),
            ))
            prev_path = str(output_path)

    logger.info(f"[Keyframe] interval: extracted {len(keyframes)} frames with significant changes")
    return keyframes


def _extract_by_scene_change(
    video_path: str,
    output_dir: Path,
    threshold: float,
    max_frames: int,
) -> list[Keyframe]:
    """基于场景变化提取关键帧（只提取变化明显的帧）"""
    import re

    # 使用更高的阈值，只检测明显场景变化
    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr",
        "-frames:v", str(max_frames * 2),  # 多提取一些，后续过滤
        str(output_dir / "scene_%04d.jpg"),
        "-y",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    timestamps = re.findall(r"pts_time:(\d+\.?\d*)", result.stderr)

    # 提取场景变化分数
    scene_scores = re.findall(r"scene:(\d+\.?\d*)", result.stderr)

    keyframes = []
    for i, ts in enumerate(sorted(timestamps, key=float)):
        output_path = output_dir / f"scene_{i:04d}.jpg"
        if output_path.exists():
            # 获取对应的场景变化分数
            score = float(scene_scores[i]) if i < len(scene_scores) else threshold
            # 只保留变化分数高于阈值的帧
            if score >= threshold:
                keyframes.append(Keyframe(
                    index=i,
                    timestamp=float(ts),
                    path=str(output_path),
                    change_score=score,
                ))

    logger.info(f"[Keyframe] scene_change: {len(timestamps)} detected, {len(keyframes)} above threshold {threshold}")
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
