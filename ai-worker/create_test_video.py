"""
创建测试视频脚本

使用 ffmpeg 生成一个简单的测试视频，用于 video_analysis_demo.py 测试。
"""

import subprocess
import sys
from pathlib import Path


def create_test_video(output_path: str = "test_video.mp4", duration: int = 10):
    """创建测试视频"""
    print(f"正在创建测试视频: {output_path}")

    # 使用 ffmpeg 创建带颜色和文字的测试视频
    cmd = [
        "ffmpeg",
        "-y",
        # 视频：彩色背景 + 时间戳文字
        "-f", "lavfi",
        "-i", f"color=c=blue:s=1280x720:d={duration},drawtext=fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='AI Coursework Evaluation Test':fontfile=/Windows/Fonts/msyh.ttc",
        # 音频：正弦波
        "-f", "lavfi",
        "-i", f"sine=frequency=440:duration={duration}",
        # 编码设置
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-shortest",
        output_path,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print(f"✅ 测试视频创建成功: {output_path}")
            print(f"   时长: {duration} 秒")
            return True
        else:
            print(f"❌ 创建失败: {result.stderr[:200]}")
            return False
    except FileNotFoundError:
        print("❌ 未找到 ffmpeg，请先安装 ffmpeg")
        print("   Windows: winget install ffmpeg")
        print("   或访问: https://ffmpeg.org/download.html")
        return False
    except Exception as e:
        print(f"❌ 创建失败: {e}")
        return False


if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else "test_video.mp4"
    duration = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    create_test_video(output, duration)
