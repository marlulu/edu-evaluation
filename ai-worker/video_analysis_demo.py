"""
视频分析 Demo - 兼容入口

此文件保留向后兼容，实际逻辑已迁移到 video_analysis/ 模块。

使用方法：
    # 作品分析
    python video_analysis_demo.py video.mp4 -T work -c criteria.docx

    # 答辩分析
    python video_analysis_demo.py video.mp4 -T defense -c criteria.pdf

    # 推荐使用模块方式
    python -m video_analysis video.mp4 -T work
"""

from video_analysis.cli import main

if __name__ == "__main__":
    main()
