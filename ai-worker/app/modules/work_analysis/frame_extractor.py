"""关键帧提取与差异计算"""

from __future__ import annotations

import base64
import logging
import shutil
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
    work_path: str,
    output_dir: Path,
    interval: float = 2.0,
    max_frames: int = 30,
) -> list[Keyframe]:
    """按间隔提取所有帧"""
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 获取视频时长
    import json
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", work_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    duration = float(json.loads(result.stdout).get("format", {}).get("duration", 0))

    frames = []
    timestamp = 0
    index = 0

    while timestamp < duration and index < max_frames:
        output_path = output_dir / f"frame_{index:04d}.jpg"
        cmd = [
            "ffmpeg", "-ss", str(timestamp), "-i", work_path,
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
    work_path: str,
    output_dir: Path,
    threshold: float = 0.08,
    max_frames: int = 15,
    interval: float = 2.0,
) -> list[Keyframe]:
    """基于画面变化提取关键帧"""
    all_frames = extract_all_frames(work_path, output_dir, interval, max_frames * 3)

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
    work_path: str,
    output_dir: Path,
    method: str = "hybrid",
    threshold: float = 0.1,
    max_frames: int = 15,
    interval: float = 2.0,
) -> list[Keyframe]:
    """使用 ffmpeg 提取关键帧（支持多种方法）"""
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    keyframes = []

    if method == "interval":
        keyframes = _extract_by_interval(work_path, output_dir, interval, max_frames)
    elif method == "scene_change":
        keyframes = _extract_by_scene_change(work_path, output_dir, threshold, max_frames)
    else:  # hybrid
        # 优先使用场景变化检测，只提取变化明显的帧
        scene_frames = _extract_by_scene_change(work_path, output_dir, threshold, max_frames)
        logger.info(f"[Keyframe] scene_change={len(scene_frames)} (threshold={threshold})")

        interval_frames = _extract_by_interval(
            work_path,
            output_dir,
            interval,
            max_frames,
        )
        keyframes = _replace_timeline_frames_with_scenes(interval_frames, scene_frames)

        logger.info(f"[Keyframe] merged={len(keyframes)}")

    logger.info(f"[Keyframe] final: {len(keyframes)} keyframes (method={method}, max={max_frames})")
    return keyframes


def _replace_timeline_frames_with_scenes(
    timeline_frames: list[Keyframe],
    scene_frames: list[Keyframe],
) -> list[Keyframe]:
    """Keep complete timeline coverage while favoring nearby scene changes."""
    if not timeline_frames:
        return []

    replacements: dict[int, Keyframe] = {}
    for scene_frame in scene_frames:
        closest_index = min(
            range(len(timeline_frames)),
            key=lambda index: abs(timeline_frames[index].timestamp - scene_frame.timestamp),
        )
        existing = replacements.get(closest_index)
        if existing is None or (scene_frame.change_score or 0) > (existing.change_score or 0):
            replacements[closest_index] = scene_frame

    selected = list(timeline_frames)
    for index, scene_frame in replacements.items():
        selected[index] = scene_frame

    return sorted(selected, key=lambda frame: frame.timestamp)


def _extract_by_interval(
    work_path: str,
    output_dir: Path,
    interval: float,
    max_frames: int,
) -> list[Keyframe]:
    """按间隔提取关键帧（作为场景变化检测的补充）"""
    import json

    # 获取视频时长
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", work_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    duration = float(json.loads(result.stdout).get("format", {}).get("duration", 0))

    logger.info(f"[Keyframe] interval extraction: duration={duration:.1f}s, interval={interval}s, max={max_frames}")

    if duration <= 0 or max_frames <= 0:
        return []

    # Spread the requested number across the complete timeline. Avoid the
    # exact end timestamp because some codecs cannot seek to the final frame.
    if max_frames == 1:
        timestamps = [0.0]
    else:
        end = max(0.0, duration - min(0.05, duration / 100))
        timestamps = [end * i / (max_frames - 1) for i in range(max_frames)]

    keyframes = []
    for i, timestamp in enumerate(timestamps):

        output_path = output_dir / f"frame_{i:04d}.jpg"
        cmd = [
            "ffmpeg", "-ss", str(timestamp), "-i", work_path,
            "-vframes", "1", "-q:v", "2", str(output_path), "-y",
        ]
        subprocess.run(cmd, capture_output=True, timeout=10)

        if output_path.exists():
            keyframes.append(Keyframe(
                index=i,
                timestamp=round(timestamp, 3),
                path=str(output_path),
            ))

    logger.info(f"[Keyframe] interval: extracted {len(keyframes)} timeline frames")
    return keyframes


def _extract_by_scene_change(
    work_path: str,
    output_dir: Path,
    threshold: float,
    max_frames: int,
) -> list[Keyframe]:
    """基于场景变化提取关键帧（只提取变化明显的帧）"""
    import re

    # 使用更高的阈值，只检测明显场景变化
    cmd = [
        "ffmpeg", "-i", work_path,
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
        output_path = output_dir / f"scene_{i + 1:04d}.jpg"
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
