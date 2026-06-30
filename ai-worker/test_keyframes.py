"""测试关键帧提取（不调用 AI）"""

import json
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image
import numpy as np


def extract_metadata(video_path: str) -> dict:
    """提取视频元数据"""
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", video_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    data = json.loads(result.stdout)
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
    fmt = data.get("format", {})
    fps = 0
    if "r_frame_rate" in video:
        try:
            n, d = video["r_frame_rate"].split("/")
            fps = float(n) / float(d)
        except Exception:
            pass
    return {"duration": float(fmt.get("duration", 0)), "fps": round(fps, 2)}


def extract_all_frames(video_path: str, interval: float = 2.0) -> list[dict]:
    """按间隔提取所有帧"""
    output_dir = Path(video_path).parent / "test_frames"
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


def calculate_frame_difference(img_path1: str, img_path2: str) -> dict:
    """计算两帧图片的差异"""
    img1 = Image.open(img_path1).convert("L").resize((160, 90))
    img2 = Image.open(img_path2).convert("L").resize((160, 90))

    arr1 = np.array(img1, dtype=np.float32)
    arr2 = np.array(img2, dtype=np.float32)

    # 像素差异
    diff = np.abs(arr1 - arr2)
    pixel_diff = np.mean(diff) / 255.0

    # 边缘差异
    def edges(arr):
        gx = np.abs(np.diff(arr, axis=1))
        gy = np.abs(np.diff(arr, axis=0))
        return gx[:gy.shape[0], :gx.shape[1]]

    edge1 = edges(arr1)
    edge2 = edges(arr2)
    edge_diff = np.mean(np.abs(edge1 - edge2)) / 255.0

    # 综合分数
    score = pixel_diff * 0.6 + edge_diff * 0.4

    return {
        "pixel_diff": round(pixel_diff, 4),
        "edge_diff": round(edge_diff, 4),
        "score": round(score, 4),
    }


def main():
    DEFAULT_VIDEO = r"E:\WeChatFiles\作品讲解.mp4"

    if len(sys.argv) > 1:
        video_path = sys.argv[1]
    else:
        video_path = DEFAULT_VIDEO

    if not os.path.exists(video_path):
        print(f"Error: File not found: {video_path}")
        sys.exit(1)

    print("=" * 60)
    print("  KEYFRAME EXTRACTION TEST")
    print("=" * 60)
    print(f"\nVideo: {video_path}")

    # 提取帧
    interval = 2.0
    print(f"\n[1/2] Extracting frames every {interval}s...")
    frames = extract_all_frames(video_path, interval)
    print(f"      Total frames: {len(frames)}")

    # 分析差异
    print("\n[2/2] Analyzing frame differences...")
    print("-" * 60)
    print(f"{'Frame':<10} {'Time':<10} {'Pixel':<10} {'Edge':<10} {'Score':<10} {'Keyframe'}")
    print("-" * 60)

    keyframes = [frames[0]]
    threshold = 0.08

    for i in range(len(frames)):
        if i == 0:
            print(f"{i:<10} {frames[i]['timestamp']:<10} {'---':<10} {'---':<10} {'---':<10} YES (first)")
            continue

        diff = calculate_frame_difference(frames[i-1]["path"], frames[i]["path"])
        is_keyframe = diff["score"] >= threshold
        marker = "YES ***" if is_keyframe else ""

        print(f"{i:<10} {frames[i]['timestamp']:<10} {diff['pixel_diff']:<10} {diff['edge_diff']:<10} {diff['score']:<10} {marker}")

        if is_keyframe:
            frames[i]["change_score"] = diff["score"]
            keyframes.append(frames[i])

    print("-" * 60)
    print(f"\n[RESULT] Found {len(keyframes)} keyframes (threshold={threshold}):")
    for kf in keyframes:
        print(f"  - {kf['timestamp']}s (score: {kf.get('change_score', 'first')})")

    # 打开关键帧文件夹
    frames_dir = Path(video_path).parent / "test_frames"
    print(f"\n[INFO] Frames saved to: {frames_dir}")


if __name__ == "__main__":
    main()
