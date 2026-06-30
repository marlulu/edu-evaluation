"""分段式传输解析使用示例

演示如何使用分段上传和解析大文件
"""

import asyncio
import base64
import hashlib
import math
import sys
from pathlib import Path

import httpx

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

# API 基础地址
BASE_URL = "http://localhost:8001"


async def example_chunked_upload():
    """示例：分段上传和解析大文件"""

    # 模拟一个大文件
    file_content = b"这是一段测试内容。\n" * 1000  # 重复内容模拟大文件
    file_name = "test_large_file.txt"
    file_size = len(file_content)
    chunk_size = 1024  # 每段 1KB
    total_chunks = math.ceil(file_size / chunk_size)

    print("=" * 60)
    print("分段式传输解析示例")
    print("=" * 60)
    print(f"文件名: {file_name}")
    print(f"文件大小: {file_size} 字节")
    print(f"分段大小: {chunk_size} 字节")
    print(f"总分段数: {total_chunks}")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. 初始化分段上传
        print("\n[1/4] 初始化分段上传...")
        init_response = await client.post(
            "/chunked/upload/init",
            json={
                "file_name": file_name,
                "file_size": file_size,
                "chunk_size": chunk_size,
            },
        )

        if init_response.status_code != 200:
            print(f"初始化失败: {init_response.text}")
            return

        init_data = init_response.json()
        session_id = init_data["session_id"]
        print(f"会话 ID: {session_id}")

        # 2. 分段上传
        print("\n[2/4] 开始分段上传...")
        for chunk_index in range(total_chunks):
            start = chunk_index * chunk_size
            end = min(start + chunk_size, file_size)
            chunk_data = file_content[start:end]

            # 计算校验和
            checksum = hashlib.md5(chunk_data).hexdigest()

            # Base64 编码
            chunk_b64 = base64.b64encode(chunk_data).decode("utf-8")

            # 上传分段
            upload_response = await client.post(
                "/chunked/upload/chunk",
                json={
                    "session_id": session_id,
                    "chunk_index": chunk_index,
                    "chunk_data": chunk_b64,
                    "checksum": checksum,
                },
            )

            if upload_response.status_code == 200:
                print(f"  分段 {chunk_index + 1}/{total_chunks} 上传成功")
            else:
                print(f"  分段 {chunk_index + 1} 上传失败: {upload_response.text}")
                return

        # 3. 开始解析
        print("\n[3/4] 开始解析...")
        parse_response = await client.post(
            "/chunked/parse/start",
            json={
                "session_id": session_id,
                "parse_options": {"extract_keywords": True},
            },
        )

        if parse_response.status_code != 200:
            print(f"解析启动失败: {parse_response.text}")
            return

        # 4. 轮询进度
        print("\n[4/4] 等待解析完成...")
        while True:
            progress_response = await client.get(
                f"/chunked/parse/{session_id}/progress"
            )

            if progress_response.status_code == 200:
                progress = progress_response.json()
                print(f"  进度: {progress['progress_percent']}% "
                      f"({progress['completed_chunks']}/{progress['total_chunks']})")

                if progress["status"] in ["completed", "failed"]:
                    break

            await asyncio.sleep(0.5)

        # 获取结果
        result_response = await client.get(
            f"/chunked/parse/{session_id}/result"
        )

        if result_response.status_code == 200:
            result = result_response.json()
            print("\n" + "=" * 60)
            print("解析完成!")
            print("=" * 60)
            print(f"状态: {result['status']}")
            print(f"处理时间: {result.get('processing_time_ms', 'N/A')} 毫秒")

            if result.get("merged_result"):
                print(f"\n合并结果预览:")
                merged = result["merged_result"]
                if "text_content" in merged:
                    print(f"  文本长度: {len(merged['text_content'])} 字符")
                if "ai_summary" in merged:
                    print(f"  AI 摘要: {merged['ai_summary'][:200]}...")

            if result.get("warnings"):
                print(f"\n警告: {result['warnings']}")
        else:
            print(f"获取结果失败: {result_response.text}")


async def example_stream_parse():
    """示例：流式解析"""

    print("\n" + "=" * 60)
    print("流式解析示例")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. 初始化流式会话
        print("\n[1/3] 初始化流式会话...")
        init_response = await client.post(
            "/chunked/stream/parse",
            json={
                "file_name": "stream_test.txt",
                "chunk_size": 512,
            },
        )

        if init_response.status_code != 200:
            print(f"初始化失败: {init_response.text}")
            return

        # 从 SSE 响应中获取 session_id
        # 注意：这里简化处理，实际应用中需要解析 SSE 流
        print("流式会话已创建")

        # 2. 发送分段数据
        print("\n[2/3] 发送分段数据...")
        test_content = "这是流式解析的测试内容。\n" * 100

        # 分割内容
        chunk_size = 256
        chunks = [
            test_content[i:i + chunk_size]
            for i in range(0, len(test_content), chunk_size)
        ]

        for i, chunk_text in enumerate(chunks):
            chunk_b64 = base64.b64encode(chunk_text.encode("utf-8")).decode("utf-8")

            chunk_response = await client.post(
                "/chunked/stream/test-session/chunk",
                json={
                    "chunk_index": i,
                    "data": chunk_b64,
                    "is_last": i == len(chunks) - 1,
                },
            )

            if chunk_response.status_code == 200:
                event = chunk_response.json()
                print(f"  分段 {i + 1}: {event['event_type']}")
            else:
                print(f"  分段 {i + 1} 失败: {chunk_response.text}")

        # 3. 获取完整内容
        print("\n[3/3] 获取完整内容...")
        content_response = await client.get(
            "/chunked/stream/test-session/content"
        )

        if content_response.status_code == 200:
            content = content_response.json()
            print(f"总字节数: {content['total_bytes']}")
            print(f"总分段数: {content['total_chunks']}")
            print(f"是否完成: {content['is_complete']}")
        else:
            print(f"获取内容失败: {content_response.text}")


async def main():
    """运行所有示例"""
    try:
        await example_chunked_upload()
        await example_stream_parse()
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
