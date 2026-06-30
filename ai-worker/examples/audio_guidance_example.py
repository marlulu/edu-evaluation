"""音频指导功能使用示例

本示例展示如何使用音频指导 API 对音频/视频文件进行专业化评价。

使用方式：
1. 启动 ai-worker 服务
2. 运行本示例：python examples/audio_guidance_example.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx


# 服务地址
BASE_URL = "http://localhost:8000"


async def check_service_health():
    """检查服务是否可用"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BASE_URL}/health")
            return response.status_code == 200
    except Exception:
        return False


async def get_capabilities():
    """获取音频指导能力"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/video/audio/guidance/capabilities")
        return response.json()


async def submit_audio_guidance(
    audio_path: str,
    guidance_type: str = "custom",
    custom_prompt: str | None = None,
    evaluation_dimensions: list[str] | None = None,
    language: str | None = None,
):
    """提交音频指导任务"""
    payload = {
        "audio_path": audio_path,
        "guidance_type": guidance_type,
        "language": language,
    }

    if custom_prompt:
        payload["custom_prompt"] = custom_prompt

    if evaluation_dimensions:
        payload["evaluation_dimensions"] = evaluation_dimensions

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{BASE_URL}/video/audio/guidance",
            json=payload,
        )
        return response.json()


async def submit_audio_guidance_async(
    audio_path: str,
    guidance_type: str = "custom",
    custom_prompt: str | None = None,
    evaluation_dimensions: list[str] | None = None,
):
    """异步提交音频指导任务"""
    payload = {
        "audio_path": audio_path,
        "guidance_type": guidance_type,
    }

    if custom_prompt:
        payload["custom_prompt"] = custom_prompt

    if evaluation_dimensions:
        payload["evaluation_dimensions"] = evaluation_dimensions

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/video/audio/guidance/async",
            json=payload,
        )
        return response.json()


async def get_task_result(task_id: str):
    """查询任务结果"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/video/audio/guidance/tasks/{task_id}"
        )
        return response.json()


def print_guidance_result(result: dict):
    """打印指导结果"""
    print("\n" + "=" * 60)
    print("音频指导结果")
    print("=" * 60)

    print(f"\n任务 ID: {result.get('task_id')}")
    print(f"文件名: {result.get('file_name')}")
    print(f"状态: {result.get('status')}")
    print(f"处理时间: {result.get('processing_time_ms')}ms")

    # 转录信息
    audio_analysis = result.get("audio_analysis")
    if audio_analysis:
        print("\n--- 转录信息 ---")
        print(f"总语音时长: {audio_analysis.get('total_speech_duration', 0):.1f} 秒")
        print(f"平均语速: {audio_analysis.get('average_speech_rate', 0):.1f} 字/分钟")
        print(f"检测语言: {audio_analysis.get('detected_language')}")
        print(f"清晰度评分: {audio_analysis.get('clarity_score', 'N/A')}")

        # 打印转录片段
        segments = audio_analysis.get("transcription", [])
        if segments:
            print(f"\n转录片段 ({len(segments)} 个):")
            for seg in segments[:5]:
                print(f"  [{seg['start_time']:.1f}s-{seg['end_time']:.1f}s] {seg['text']}")
            if len(segments) > 5:
                print(f"  ... 还有 {len(segments) - 5} 个片段")

    # 指导内容
    guidance = result.get("guidance")
    if guidance:
        print("\n--- 指导内容 ---")
        print(f"\n综合评分: {guidance.get('score', 'N/A')}")
        print(f"\n总体评价:\n{guidance.get('summary')}")

        strengths = guidance.get("strengths", [])
        if strengths:
            print("\n优点:")
            for s in strengths:
                print(f"  ✓ {s}")

        weaknesses = guidance.get("weaknesses", [])
        if weaknesses:
            print("\n不足:")
            for w in weaknesses:
                print(f"  ✗ {w}")

        suggestions = guidance.get("suggestions", [])
        if suggestions:
            print("\n改进建议:")
            for s in suggestions:
                print(f"  → {s}")

        detailed = guidance.get("detailed_feedback")
        if detailed:
            print(f"\n详细反馈:\n{detailed}")

        # 维度评价
        dim_evals = guidance.get("dimension_evaluations")
        if dim_evals:
            print("\n维度评价:")
            for dim in dim_evals:
                print(f"  {dim['dimension_name']}: {dim['score']}分 - {dim['feedback']}")

    print("\n" + "=" * 60)


async def main():
    """主函数"""
    print("音频指导功能示例")
    print("=" * 60)

    # 检查服务
    print("\n检查服务状态...")
    if not await check_service_health():
        print("错误: 服务未启动，请先启动 ai-worker 服务")
        print("启动命令: cd ai-worker && uvicorn app.main:app --reload")
        return

    print("服务已启动 ✓")

    # 获取能力
    print("\n获取音频指导能力...")
    capabilities = await get_capabilities()
    print(f"支持的格式: {capabilities.get('supported_formats')}")
    print(f"指导类型: {[t['type'] for t in capabilities.get('guidance_types', [])]}")

    # 检查是否有测试音频文件
    test_audio = os.environ.get("TEST_AUDIO_PATH")
    if not test_audio:
        print("\n提示: 设置 TEST_AUDIO_PATH 环境变量指向一个音频/视频文件")
        print("示例: export TEST_AUDIO_PATH=/path/to/your/audio.mp3")
        print("\n使用 Mock 模式演示...")

        # Mock 模式 - 展示请求格式
        print("\n--- 示例请求 ---")
        example_request = {
            "audio_path": "/path/to/audio.mp3",
            "guidance_type": "custom",
            "custom_prompt": "请从专业性、表达能力、逻辑性三个方面对这段音频内容进行评价",
            "evaluation_dimensions": ["专业性", "表达能力", "逻辑性"],
            "language": "zh",
        }
        print(json.dumps(example_request, indent=2, ensure_ascii=False))

        print("\n--- 示例响应结构 ---")
        example_response = {
            "task_id": "uuid",
            "file_name": "audio.mp3",
            "status": "completed",
            "audio_analysis": {
                "transcription": "[...]",
                "total_speech_duration": 120.5,
                "average_speech_rate": 180.0,
                "detected_language": "zh",
                "clarity_score": 0.85,
            },
            "guidance": {
                "summary": "总体评价...",
                "strengths": ["优点1", "优点2"],
                "weaknesses": ["不足1"],
                "suggestions": ["建议1", "建议2"],
                "detailed_feedback": "详细反馈...",
                "score": 85,
                "dimension_evaluations": [
                    {"dimension_name": "专业性", "score": 90, "feedback": "..."},
                    {"dimension_name": "表达能力", "score": 80, "feedback": "..."},
                ],
            },
        }
        print(json.dumps(example_response, indent=2, ensure_ascii=False))
        return

    # 使用真实音频文件
    print(f"\n使用音频文件: {test_audio}")

    if not os.path.exists(test_audio):
        print(f"错误: 文件不存在: {test_audio}")
        return

    # 示例 1: 通用指导
    print("\n\n【示例 1: 通用指导】")
    result = await submit_audio_guidance(
        audio_path=test_audio,
        guidance_type="general",
    )
    print_guidance_result(result)

    # 示例 2: 演讲评价
    print("\n\n【示例 2: 演讲评价】")
    result = await submit_audio_guidance(
        audio_path=test_audio,
        guidance_type="speech",
    )
    print_guidance_result(result)

    # 示例 3: 自定义评价
    print("\n\n【示例 3: 自定义评价】")
    result = await submit_audio_guidance(
        audio_path=test_audio,
        guidance_type="custom",
        custom_prompt="请从内容深度、表达技巧、听众吸引力三个方面对这段音频进行专业评价，并给出具体的改进建议。",
        evaluation_dimensions=["内容深度", "表达技巧", "听众吸引力"],
    )
    print_guidance_result(result)


if __name__ == "__main__":
    asyncio.run(main())
