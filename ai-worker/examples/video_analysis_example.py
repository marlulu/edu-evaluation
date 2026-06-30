"""视频分析使用示例

演示如何使用视频分析 API
"""

import asyncio
import sys
from pathlib import Path

import httpx

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

BASE_URL = "http://localhost:8001"


async def analyze_video_example(video_path: str):
    """分析视频示例"""
    print("=" * 60)
    print("视频分析示例")
    print("=" * 60)
    print(f"视频文件: {video_path}")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=300.0) as client:
        # 1. 检查服务状态
        print("\n[1/5] 检查服务状态...")
        try:
            health = await client.get(f"{BASE_URL}/health")
            if health.status_code == 200:
                print("✅ AI Worker 服务正常")
            else:
                print("❌ 服务异常")
                return
        except Exception as e:
            print(f"❌ 无法连接服务: {e}")
            return

        # 2. 获取支持的能力
        print("\n[2/5] 获取支持的能力...")
        capabilities = await client.get(f"{BASE_URL}/video/capabilities")
        caps = capabilities.json()
        print(f"✅ 支持格式: {', '.join(caps['supported_formats'])}")
        print(f"✅ 最大时长: {caps['max_duration_seconds'] / 60} 分钟")

        # 3. 提交分析任务
        print("\n[3/5] 提交分析任务...")
        file_name = Path(video_path).name

        # 异步提交任务
        submit_response = await client.post(
            f"{BASE_URL}/video/analyze/async",
            json={
                "file_name": file_name,
                "file_path": video_path,
                "options": {
                    "extract_keyframes": True,
                    "keyframe_method": "hybrid",
                    "max_keyframes": 20,
                    "transcribe_audio": True,
                    "analyze_content": True,
                },
            },
        )

        if submit_response.status_code != 200:
            print(f"❌ 提交失败: {submit_response.text}")
            return

        task_id = submit_response.json()["task_id"]
        print(f"✅ 任务已提交: {task_id}")

        # 4. 轮询任务状态
        print("\n[4/5] 等待分析完成...")
        while True:
            status_response = await client.get(f"{BASE_URL}/video/tasks/{task_id}")
            status = status_response.json()

            progress = status.get("progress", 0)
            current_status = status.get("status", "unknown")
            print(f"  状态: {current_status} | 进度: {progress}%", end="\r")

            if current_status in ["completed", "failed"]:
                print()
                break

            await asyncio.sleep(1)

        # 5. 获取结果
        print("\n[5/5] 获取分析结果...")
        result_response = await client.get(f"{BASE_URL}/video/tasks/{task_id}")
        result = result_response.json()

        if result["status"] == "completed":
            print("\n" + "=" * 60)
            print("分析完成!")
            print("=" * 60)

            # 显示元数据
            if result.get("metadata"):
                meta = result["metadata"]
                print(f"\n📹 视频信息:")
                print(f"  时长: {meta['duration_seconds']:.1f} 秒")
                print(f"  分辨率: {meta['width']} × {meta['height']}")
                print(f"  帧率: {meta['fps']:.1f} fps")
                print(f"  文件大小: {meta['file_size'] / (1024*1024):.1f} MB")

            # 显示关键帧
            if result.get("keyframes"):
                print(f"\n🖼️ 关键帧: {len(result['keyframes'])} 帧")
                for i, frame in enumerate(result["keyframes"][:5]):
                    print(f"  帧 {i+1}: {frame['timestamp_seconds']:.1f}s")

            # 显示语音转录
            if result.get("audio_analysis"):
                audio = result["audio_analysis"]
                print(f"\n🎤 语音分析:")
                print(f"  语言: {audio['detected_language']}")
                print(f"  语速: {audio['average_speech_rate']:.0f} 字/分钟")
                print(f"  转录片段: {len(audio['transcription'])} 段")
                if audio["transcription"]:
                    print(f"  前3段内容:")
                    for seg in audio["transcription"][:3]:
                        print(f"    [{seg['start_time']:.1f}s-{seg['end_time']:.1f}s] {seg['text'][:50]}...")

            # 显示内容分析
            if result.get("content_analysis"):
                content = result["content_analysis"]
                print(f"\n📝 内容分析:")
                print(f"  主题: {content['overall_topic']}")
                print(f"  摘要: {content['summary'][:100]}...")
                if content.get("key_points"):
                    print(f"  关键点:")
                    for point in content["key_points"][:3]:
                        print(f"    • {point}")

            # 显示质量评估
            if result.get("technical_quality"):
                quality = result["technical_quality"]
                print(f"\n⭐ 质量评估:")
                print(f"  视频质量: {quality['video_quality']}")
                print(f"  音频质量: {quality['audio_quality']}")
                print(f"  综合评分: {quality['overall_score']}/100")

            # 处理信息
            if result.get("processing_time_ms"):
                print(f"\n⏱️ 处理时间: {result['processing_time_ms'] / 1000:.1f} 秒")

        else:
            print(f"\n❌ 分析失败: {result.get('error', '未知错误')}")


async def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python video_analysis_example.py <视频文件路径>")
        print("\n示例:")
        print("  python video_analysis_example.py /path/to/video.mp4")
        return

    video_path = sys.argv[1]

    if not Path(video_path).exists():
        print(f"❌ 文件不存在: {video_path}")
        return

    await analyze_video_example(video_path)


if __name__ == "__main__":
    asyncio.run(main())
