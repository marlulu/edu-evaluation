"""命令行入口与主流程编排"""

import argparse
import os
import sys

from dotenv import load_dotenv
from openai import OpenAI

from .metadata import extract_metadata
from .audio import extract_audio, analyze_audio
from .frames import extract_keyframes
from .ocr import ocr_keyframes
from .transcription import transcribe_audio
from .ai_analyzer import describe_all_frames_with_ai, analyze_with_ai, evaluate_with_criteria
from .criteria import parse_criteria_file, get_default_criteria

load_dotenv()


def parse_args():
    parser = argparse.ArgumentParser(description="视频分析工具 - 本地 + OCR + AI + 评判标准")
    parser.add_argument("video", nargs="?", default=r"E:\video\视频作品.mp4", help="视频文件路径")
    parser.add_argument("-T", "--type", choices=["work", "defense"], default="work",
                        help="视频类型: work=作品讲解, defense=答辩 (默认: work)")
    parser.add_argument("-c", "--criteria", help="评判标准文件路径 (PDF/Word)，不指定则使用内置默认标准")
    parser.add_argument("-n", "--max-frames", type=int, default=15, help="最大关键帧数量 (默认: 15)")
    parser.add_argument("-i", "--interval", type=float, default=2.0, help="采样间隔秒数 (默认: 2.0)")
    parser.add_argument("-t", "--threshold", type=float, default=0.08, help="变化阈值 (默认: 0.08)")
    return parser.parse_args()


def run_analysis(video_path: str, video_type: str = "work", criteria_path: str = None,
                 max_frames: int = 15, interval: float = 2.0, threshold: float = 0.08) -> dict:
    """执行完整视频分析流程，返回分析结果字典"""
    type_name = "答辩分析" if video_type == "defense" else "作品讲解分析"
    print("=" * 60)
    print(f"  VIDEO ANALYSIS - {type_name}")
    print("=" * 60)
    print(f"  Video: {video_path}")
    print(f"  Type: {type_name}")
    print(f"  Criteria: {criteria_path if criteria_path else '内置默认标准'}")
    print(f"  Keyframes: max={max_frames}, interval={interval}s, threshold={threshold}")
    print("=" * 60)

    result = {
        "video_path": video_path,
        "video_type": video_type,
        "metadata": None,
        "audio_analysis": None,
        "keyframes": None,
        "scene_description": None,
        "transcription": None,
        "ai_analysis": None,
        "criteria_text": None,
        "evaluation": None,
    }

    # ===== Phase 1: 本地分析 =====
    print("\n[PHASE 1] Local Analysis")

    print("\n[1/5] Extracting video metadata...")
    metadata = extract_metadata(video_path)
    result["metadata"] = metadata
    print(f"      Duration: {metadata['duration']:.1f}s")
    print(f"      Resolution: {metadata['width']}x{metadata['height']}")
    print(f"      FPS: {metadata['fps']}")

    print("\n[2/5] Extracting audio...")
    audio_path = extract_audio(video_path)
    print(f"      Audio extracted")

    print("\n[3/5] Analyzing audio features...")
    audio_analysis = analyze_audio(audio_path)
    result["audio_analysis"] = audio_analysis
    print(f"      Mean volume: {audio_analysis['volume'].get('mean', 'N/A')} dB")
    print(f"      Silence segments: {len(audio_analysis['silence'])}")

    print("\n[4/5] Extracting keyframes...")
    keyframes = extract_keyframes(video_path, threshold=threshold, max_frames=max_frames, interval=interval)
    print(f"      Extracted {len(keyframes)} keyframes")

    print("\n[5/5] OCR keyframe content...")
    keyframes = ocr_keyframes(keyframes)
    result["keyframes"] = keyframes
    for kf in keyframes:
        print(f"      [{kf['timestamp']}s] {kf['ocr_summary'][:50]}...")

    # ===== Phase 2: AI 分析 =====
    print("\n" + "=" * 60)
    print("[PHASE 2] AI Analysis")

    api_key = os.getenv("MODEL_API_KEY")
    base_url = os.getenv("MODEL_API_BASE_URL")

    if not api_key or not base_url:
        print("\n[SKIP] AI analysis - API not configured")
        print("       Set MODEL_API_KEY and MODEL_API_BASE_URL in .env")
    else:
        client = OpenAI(api_key=api_key, base_url=base_url)
        model = os.getenv("VISION_MODEL_NAME", os.getenv("TEXT_MODEL_NAME", "gpt-5.5"))

        # 画面场景描述
        print("\n[1/3] Describing all keyframes with AI vision (single call)...")
        scene_description = describe_all_frames_with_ai(client, model, keyframes)
        result["scene_description"] = scene_description
        print(f"      Scene description: {scene_description[:100]}...")

        # 语音转录
        print("\n[2/3] Transcribing audio...")
        transcription = transcribe_audio(client, model, audio_path)
        result["transcription"] = transcription
        if transcription:
            print(f"      Transcription: {transcription[:100]}...")

        # AI 综合分析
        print("\n[3/3] AI comprehensive analysis (text only)...")
        local_data = {
            "metadata": metadata,
            "audio_analysis": audio_analysis,
            "transcription": transcription,
            "keyframes": keyframes,
            "scene_description": scene_description,
        }
        ai_analysis = analyze_with_ai(client, model, local_data)
        result["ai_analysis"] = ai_analysis

        print("\n" + "=" * 60)
        print("  AI ANALYSIS RESULT")
        print("=" * 60)
        print(ai_analysis)

        # ===== Phase 3: 评判标准评分 =====
        print("\n" + "=" * 60)
        print("[PHASE 3] Criteria Evaluation")

        if criteria_path:
            if not os.path.exists(criteria_path):
                print(f"      [ERROR] Criteria file not found: {criteria_path}")
                criteria_text = get_default_criteria(video_type)
                print(f"      [FALLBACK] Using default {type_name} criteria")
            else:
                print(f"\n[1/1] Parsing criteria file: {criteria_path}")
                criteria_text = parse_criteria_file(criteria_path)
                print(f"      Extracted {len(criteria_text)} characters")
        else:
            print(f"\n[1/1] Using default {type_name} criteria")
            criteria_text = get_default_criteria(video_type)

        result["criteria_text"] = criteria_text

        print("\n      Evaluating against criteria...")
        evaluation = evaluate_with_criteria(client, model, ai_analysis, criteria_text, video_type)
        result["evaluation"] = evaluation

        print("\n" + "=" * 60)
        print("  EVALUATION RESULT")
        print("=" * 60)
        print(evaluation)

    # 清理
    if os.path.exists(audio_path):
        os.unlink(audio_path)

    print("\n[Done] Video analysis completed.")
    return result


def main():
    args = parse_args()

    if not os.path.exists(args.video):
        print(f"Error: File not found: {args.video}")
        sys.exit(1)

    run_analysis(
        video_path=args.video,
        video_type=args.type,
        criteria_path=args.criteria,
        max_frames=args.max_frames,
        interval=args.interval,
        threshold=args.threshold,
    )
