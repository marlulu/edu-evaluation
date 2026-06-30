"""检查视频分析依赖是否安装"""

import shutil
import subprocess
import sys


def check_ffmpeg():
    """检查 FFmpeg 是否安装"""
    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")

    if ffmpeg_path and ffprobe_path:
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            version_line = result.stdout.split("\n")[0] if result.stdout else "unknown"
            return True, version_line
        except Exception:
            return True, "installed (version unknown)"
    else:
        return False, None


def check_python_packages():
    """检查 Python 包是否安装"""
    required_packages = [
        "fastapi",
        "uvicorn",
        "pydantic",
        "httpx",
        "openai",
    ]

    missing = []
    installed = []

    for package in required_packages:
        try:
            __import__(package.replace("-", "_"))
            installed.append(package)
        except ImportError:
            missing.append(package)

    return installed, missing


def main():
    print("=" * 60)
    print("视频分析依赖检查")
    print("=" * 60)

    # 检查 FFmpeg
    print("\n[1/2] 检查 FFmpeg...")
    ffmpeg_ok, ffmpeg_version = check_ffmpeg()
    if ffmpeg_ok:
        print(f"✅ FFmpeg 已安装: {ffmpeg_version}")
    else:
        print("❌ FFmpeg 未安装")
        print("\n安装方法:")
        print("  Windows: winget install ffmpeg")
        print("  macOS: brew install ffmpeg")
        print("  Linux: sudo apt install ffmpeg")

    # 检查 Python 包
    print("\n[2/2] 检查 Python 包...")
    installed, missing = check_python_packages()

    if installed:
        print(f"✅ 已安装: {', '.join(installed)}")

    if missing:
        print(f"❌ 缺少: {', '.join(missing)}")
        print("\n安装命令:")
        print(f"  pip install {' '.join(missing)}")
    else:
        print("✅ 所有必需包已安装")

    # 总结
    print("\n" + "=" * 60)
    if ffmpeg_ok and not missing:
        print("✅ 所有依赖已就绪，可以开始使用视频分析功能！")
        print("\n启动命令:")
        print("  uvicorn app.main:app --reload --port 8001")
    else:
        print("⚠️  请先安装缺少的依赖")
    print("=" * 60)


if __name__ == "__main__":
    main()
