"""分析关键帧图片内容（OCR + 图像特征）"""

import json
import os
import sys
from pathlib import Path

from PIL import Image
import numpy as np


def analyze_image_features(image_path: str) -> dict:
    """分析图像基本特征"""
    img = Image.open(image_path)
    arr = np.array(img)

    # 尺寸
    width, height = img.size

    # 颜色统计
    if len(arr.shape) == 3:
        mean_rgb = arr.mean(axis=(0, 1)).tolist()
        # 主色调
        dominant = "warm" if mean_rgb[0] > mean_rgb[2] else "cool"
    else:
        mean_rgb = [float(arr.mean())]
        dominant = "grayscale"

    # 亮度
    gray = img.convert("L")
    brightness = np.array(gray).mean() / 255.0

    # 对比度
    contrast = np.array(gray).std() / 255.0

    # 边缘密度（文字/内容丰富度指标）
    gray_arr = np.array(gray, dtype=np.float32)
    gx = np.abs(np.diff(gray_arr, axis=1))
    gy = np.abs(np.diff(gray_arr, axis=0))
    edge_density = (gx.mean() + gy.mean()) / 2 / 255.0

    return {
        "size": f"{width}x{height}",
        "brightness": round(brightness, 3),
        "contrast": round(contrast, 3),
        "edge_density": round(edge_density, 4),
        "dominant_tone": dominant,
        "mean_rgb": [round(v, 1) for v in mean_rgb[:3]],
    }


def ocr_image(image_path: str, reader) -> list[dict]:
    """OCR 识别图片中的文字"""
    try:
        results = reader.ocr(image_path, cls=True)
        texts = []
        if results and results[0]:
            for line in results[0]:
                bbox, (text, conf) = line[0], line[1]
                if conf > 0.5:
                    x_min = min(p[0] for p in bbox)
                    y_min = min(p[1] for p in bbox)
                    x_max = max(p[0] for p in bbox)
                    y_max = max(p[1] for p in bbox)
                    texts.append({
                        "text": text,
                        "position": f"({int(x_min)},{int(y_min)})-({int(x_max)},{int(y_max)})",
                        "confidence": round(conf, 2),
                    })
        return texts
    except Exception as e:
        return [{"text": f"OCR Error: {e}", "confidence": 0}]


def main():
    DEFAULT_DIR = r"E:\WeChatFiles\test_frames"

    if len(sys.argv) > 1:
        frames_dir = sys.argv[1]
    else:
        frames_dir = DEFAULT_DIR

    if not os.path.exists(frames_dir):
        print(f"Error: Directory not found: {frames_dir}")
        print("Usage: python analyze_frames.py <frames_directory>")
        sys.exit(1)

    # 获取所有图片
    images = sorted(Path(frames_dir).glob("*.jpg"))
    if not images:
        print(f"No JPG images found in {frames_dir}")
        sys.exit(1)

    print("=" * 60)
    print("  FRAME CONTENT ANALYSIS")
    print("=" * 60)
    print(f"\nDirectory: {frames_dir}")
    print(f"Images found: {len(images)}")

    # 初始化 PaddleOCR
    print("\n[1/2] Loading PaddleOCR model...")
    from paddleocr import PaddleOCR
    reader = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)

    # 分析每张图片
    print("[2/2] Analyzing images...\n")

    results = []
    for i, img_path in enumerate(images):
        print(f"{'='*60}")
        print(f"[{i+1}/{len(images)}] {img_path.name}")
        print(f"{'='*60}")

        # 图像特征
        features = analyze_image_features(str(img_path))
        print(f"\n  [Features]")
        print(f"    Size: {features['size']}")
        print(f"    Brightness: {features['brightness']}")
        print(f"    Contrast: {features['contrast']}")
        print(f"    Edge density: {features['edge_density']}")

        # OCR
        print(f"\n  [OCR Text]")
        texts = ocr_image(str(img_path), reader)
        if texts:
            for t in texts:
                print(f"    - {t['text']} ({t['confidence']})")
        else:
            print("    (no text detected)")

        results.append({
            "file": img_path.name,
            "features": features,
            "ocr_texts": texts,
        })

    # 保存结果
    output_path = Path(frames_dir) / "analysis_result.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n[SAVED] Results saved to: {output_path}")


if __name__ == "__main__":
    main()
