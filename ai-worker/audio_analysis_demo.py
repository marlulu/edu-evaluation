"""
音频分析 Demo - 本地分析（不依赖 AI API）

功能：
1. 音频元数据提取
2. 音量/响度分析
3. 静音段检测
4. 语速估算（需要转录）

使用方法：
    python audio_analysis_demo.py E:/path/to/audio.mp3
"""

import json
import os
import subprocess
import sys
from pathlib import Path


def get_audio_metadata(audio_path: str) -> dict:
    """提取音频元数据"""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        audio_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    data = json.loads(result.stdout)

    audio_stream = next(
        (s for s in data.get("streams", []) if s.get("codec_type") == "audio"),
        {},
    )
    fmt = data.get("format", {})

    return {
        "duration": float(fmt.get("duration", 0)),
        "size_bytes": int(fmt.get("size", 0)),
        "bitrate": int(fmt.get("bit_rate", 0)),
        "codec": audio_stream.get("codec_name", "unknown"),
        "sample_rate": int(audio_stream.get("sample_rate", 0)),
        "channels": int(audio_stream.get("channels", 0)),
        "channel_layout": audio_stream.get("channel_layout", "unknown"),
    }


def analyze_volume(audio_path: str) -> dict:
    """分析音频音量（使用 ffmpeg volumedetect）"""
    cmd = [
        "ffmpeg", "-i", audio_path,
        "-af", "volumedetect",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    output = result.stderr

    # 解析 volumedetect 输出
    info = {}
    for line in output.split("\n"):
        if "mean_volume" in line:
            info["mean_volume"] = float(line.split("mean_volume:")[1].strip().replace(" dB", ""))
        elif "max_volume" in line:
            info["max_volume"] = float(line.split("max_volume:")[1].strip().replace(" dB", ""))
        elif "histogram_" in line:
            # 解析音量直方图
            pass

    return info


def detect_silence(audio_path: str, threshold_db: float = -30, min_duration: float = 0.5) -> list[dict]:
    """检测静音段"""
    cmd = [
        "ffmpeg", "-i", audio_path,
        "-af", f"silencedetect=noise={threshold_db}dB:d={min_duration}",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    output = result.stderr

    silence_segments = []
    current_start = None

    for line in output.split("\n"):
        if "silence_start:" in line:
            current_start = float(line.split("silence_start:")[1].strip())
        elif "silence_end:" in line and current_start is not None:
            parts = line.split("silence_end:")[1].strip().split()
            end = float(parts[0])
            duration = float(parts[1].replace("|", "").strip()) if len(parts) > 1 else end - current_start
            silence_segments.append({
                "start": round(current_start, 2),
                "end": round(end, 2),
                "duration": round(duration, 2),
            })
            current_start = None

    return silence_segments


def analyze_frequency(audio_path: str, duration: float) -> dict:
    """分析音频频率特征（使用 astats）"""
    # 只分析前30秒以节省时间
    analyze_duration = min(duration, 30)

    cmd = [
        "ffmpeg", "-i", audio_path,
        "-t", str(analyze_duration),
        "-af", "astats=metadata=1:reset=1",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    output = result.stderr

    # 基本统计
    stats = {
        "analyzed_duration": analyze_duration,
        "has_clipping": "Peak level:" in output and float(output.split("Peak level:")[1].split()[0]) > 0.99,
    }

    return stats


def get_audio_format_info(audio_path: str) -> dict:
    """获取音频格式详细信息"""
    ext = Path(audio_path).suffix.lower()

    format_map = {
        ".mp3": "MP3",
        ".wav": "WAV",
        ".aac": "AAC",
        ".flac": "FLAC",
        ".ogg": "OGG",
        ".m4a": "M4A",
        ".wma": "WMA",
    }

    return {
        "extension": ext,
        "format_name": format_map.get(ext, "Unknown"),
    }


def analyze_audio(audio_path: str) -> dict:
    """完整的音频分析流程"""
    print(f"[1/5] Analyzing: {audio_path}")

    # 检查文件
    if not os.path.exists(audio_path):
        return {"error": f"File not found: {audio_path}"}

    file_size = os.path.getsize(audio_path)
    print(f"      File size: {file_size / 1024 / 1024:.2f} MB")

    # 格式信息
    format_info = get_audio_format_info(audio_path)
    print(f"[2/5] Format: {format_info['format_name']} ({format_info['extension']})")

    # 元数据
    print("[3/5] Extracting metadata...")
    metadata = get_audio_metadata(audio_path)
    print(f"      Duration: {metadata['duration']:.2f}s")
    print(f"      Codec: {metadata['codec']}")
    print(f"      Sample rate: {metadata['sample_rate']}Hz")
    print(f"      Channels: {metadata['channels']}")

    # 音量分析
    print("[4/5] Analyzing volume...")
    volume = analyze_volume(audio_path)
    if volume:
        print(f"      Mean volume: {volume.get('mean_volume', 'N/A')} dB")
        print(f"      Max volume: {volume.get('max_volume', 'N/A')} dB")

    # 静音检测
    print("[5/5] Detecting silence...")
    silence = detect_silence(audio_path)
    print(f"      Found {len(silence)} silence segments")

    # 频率分析
    freq_stats = analyze_frequency(audio_path, metadata['duration'])

    return {
        "file": {
            "path": audio_path,
            "size_mb": round(file_size / 1024 / 1024, 2),
            "format": format_info,
        },
        "metadata": metadata,
        "volume": volume,
        "silence_segments": silence,
        "silence_count": len(silence),
        "total_silence_duration": round(sum(s["duration"] for s in silence), 2),
        "frequency_stats": freq_stats,
    }


def print_report(result: dict):
    """打印分析报告"""
    if "error" in result:
        print(f"\n[ERROR] {result['error']}")
        return

    print("\n" + "=" * 60)
    print("  AUDIO ANALYSIS REPORT")
    print("=" * 60)

    # 文件信息
    file_info = result["file"]
    print(f"\n[FILE]")
    print(f"  Path: {file_info['path']}")
    print(f"  Size: {file_info['size_mb']} MB")
    print(f"  Format: {file_info['format']['format_name']}")

    # 元数据
    meta = result["metadata"]
    print(f"\n[METADATA]")
    print(f"  Duration: {meta['duration']:.2f} seconds")
    print(f"  Codec: {meta['codec']}")
    print(f"  Sample Rate: {meta['sample_rate']} Hz")
    print(f"  Channels: {meta['channels']}")
    print(f"  Bitrate: {meta['bitrate'] / 1000:.0f} kbps")

    # 音量
    vol = result["volume"]
    if vol:
        print(f"\n[VOLUME]")
        print(f"  Mean: {vol.get('mean_volume', 'N/A')} dB")
        print(f"  Max: {vol.get('max_volume', 'N/A')} dB")

    # 静音
    print(f"\n[SILENCE]")
    print(f"  Segments: {result['silence_count']}")
    print(f"  Total Duration: {result['total_silence_duration']}s")
    if result["silence_segments"]:
        print("  Details:")
        for i, seg in enumerate(result["silence_segments"][:5], 1):
            print(f"    {i}. {seg['start']}s - {seg['end']}s ({seg['duration']}s)")
        if len(result["silence_segments"]) > 5:
            print(f"    ... and {len(result['silence_segments']) - 5} more")

    # 统计
    duration = meta["duration"]
    silence_ratio = (result["total_silence_duration"] / duration * 100) if duration > 0 else 0
    print(f"\n[SUMMARY]")
    print(f"  Speech ratio: {100 - silence_ratio:.1f}%")
    print(f"  Silence ratio: {silence_ratio:.1f}%")


def main():
    # 默认音频路径
    DEFAULT_AUDIO = r"E:\WeChatFiles\作品讲解.mp3"

    if len(sys.argv) > 1:
        audio_path = sys.argv[1]
    else:
        audio_path = DEFAULT_AUDIO
        print(f"Using default audio: {audio_path}")

    if not os.path.exists(audio_path):
        print(f"Error: File not found: {audio_path}")
        print("Usage: python audio_analysis_demo.py <audio_path>")
        sys.exit(1)

    # 执行分析
    result = analyze_audio(audio_path)

    # 打印报告
    print_report(result)

    # 保存结果
    output_path = Path(audio_path).with_suffix(".analysis.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n[SAVED] Analysis saved to: {output_path}")


if __name__ == "__main__":
    main()
