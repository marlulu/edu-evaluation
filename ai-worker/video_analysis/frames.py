"""关键帧提取与差异计算"""

import subprocess
from pathlib import Path

from .metadata import extract_metadata


def extract_all_frames(video_path: str, interval: float = 2.0) -> list[dict]:
    """按间隔提取所有帧"""
    output_dir = Path(video_path).parent / "frames"
    output_dir.mkdir(exist_ok=True)

    metadata = extract_metadata(video_path)
    duration = metadata["duration"]

    frames = []
    timestamp = 0
    index = 0
    while timestamp < duration:
        output_path = output_dir / f"frame_{index:04d}.jpg"
        cmd = [
            "ffmpeg", "-ss", str(timestamp), "-i", video_path,
            "-vframes", "1", "-q:v", "2", str(output_path), "-y",
        ]
        subprocess.run(cmd, capture_output=True, timeout=10)
        if output_path.exists():
            frames.append({"index": index, "timestamp": round(timestamp, 2), "path": str(output_path)})
        timestamp += interval
        index += 1

    return frames


def calculate_frame_difference(img_path1: str, img_path2: str) -> float:
    """计算两帧图片的差异程度（像素差异 + 边缘差异）"""
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

    score = mean_diff * 0.6 + edge_diff * 0.4
    return round(score, 4)


def extract_keyframes(video_path: str, threshold: float = 0.08, max_frames: int = 10, interval: float = 2.0) -> list[dict]:
    """基于画面变化提取关键帧"""
    print(f"      Extracting frames every {interval}s...")
    all_frames = extract_all_frames(video_path, interval)
    print(f"      Total frames: {len(all_frames)}")

    if len(all_frames) < 2:
        return all_frames

    print("      Analyzing frame differences...")
    keyframes = [all_frames[0]]

    for i in range(1, len(all_frames)):
        change = calculate_frame_difference(all_frames[i-1]["path"], all_frames[i]["path"])

        if change >= threshold:
            all_frames[i]["change_score"] = change
            keyframes.append(all_frames[i])
            print(f"      [{all_frames[i]['timestamp']}s] Change detected: {change}")

        if len(keyframes) >= max_frames:
            break

    return keyframes
