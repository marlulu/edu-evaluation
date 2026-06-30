"""模型验证测试脚本

用于测试模型配置是否有效
"""

import asyncio
import sys
from pathlib import Path

import httpx

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

BASE_URL = "http://localhost:8001"


async def test_health():
    """测试 AI Worker 健康状态"""
    print("=" * 60)
    print("1. 测试 AI Worker 健康状态")
    print("=" * 60)

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ AI Worker 运行正常")
                print(f"   服务名称: {data.get('service')}")
                print(f"   模型网关: {'已配置' if data.get('modelGatewayConfigured') else '未配置'}")
                return True
            else:
                print(f"❌ AI Worker 响应异常: HTTP {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 无法连接 AI Worker: {e}")
            return False


async def test_quick_model():
    """快速测试默认模型配置"""
    print("\n" + "=" * 60)
    print("2. 快速测试默认模型配置")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{BASE_URL}/models/test/quick")
            data = response.json()

            if data["success"]:
                print(f"✅ 模型测试通过")
                print(f"   模型名称: {data['model_name']}")
                print(f"   响应时间: {data.get('response_time_ms', 'N/A')}ms")
                if data.get("ai_response"):
                    print(f"   AI 响应: {data['ai_response'][:100]}...")
            else:
                print(f"❌ 模型测试失败")
                print(f"   错误信息: {data.get('message')}")

            # 显示详细检查结果
            print(f"\n   检查详情:")
            for check in data.get("checks", []):
                if isinstance(check, dict):
                    status = "✅" if check.get("passed") else "❌"
                    print(f"   {status} {check.get('name')}: {check.get('message')}")
                else:
                    print(f"   - {check}")

            return data["success"]

        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return False


async def test_custom_model(model_name: str, base_url: str, has_api_key: bool):
    """测试自定义模型配置"""
    print("\n" + "=" * 60)
    print("3. 测试自定义模型配置")
    print("=" * 60)
    print(f"   模型名称: {model_name}")
    print(f"   API 地址: {base_url}")
    print(f"   API Key: {'已配置' if has_api_key else '未配置'}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{BASE_URL}/models/test",
                json={
                    "model_name": model_name,
                    "base_url": base_url,
                    "api_key_configured": has_api_key,
                    "test_prompt": "请回复'测试成功'四个字。",
                    "max_tokens": 50,
                },
            )
            data = response.json()

            if data["success"]:
                print(f"\n✅ 模型测试通过")
                print(f"   总耗时: {data.get('response_time_ms', 'N/A')}ms")
                if data.get("ai_response"):
                    print(f"   AI 响应: {data['ai_response']}")
            else:
                print(f"\n❌ 模型测试失败")
                print(f"   错误信息: {data.get('message')}")
                if data.get("error"):
                    print(f"   详细错误: {data['error']}")

            # 显示详细检查结果
            print(f"\n   检查详情:")
            for check in data.get("checks", []):
                if isinstance(check, dict):
                    status = "✅" if check.get("passed") else "❌"
                    duration = f" ({check.get('duration_ms')}ms)" if check.get("duration_ms") else ""
                    print(f"   {status} {check.get('name')}: {check.get('message')}{duration}")
                else:
                    print(f"   - {check}")

            return data["success"]

        except Exception as e:
            print(f"❌ 测试失败: {e}")
            return False


async def main():
    """主测试流程"""
    print("🤖 AI 模型配置验证工具")
    print("=" * 60)

    # 1. 测试健康状态
    health_ok = await test_health()
    if not health_ok:
        print("\n⚠️  AI Worker 未运行，请先启动服务:")
        print("   cd ai-worker")
        print("   uvicorn app.main:app --reload --port 8001")
        return

    # 2. 快速测试默认配置
    await test_quick_model()

    # 3. 测试自定义配置（如果有命令行参数）
    if len(sys.argv) >= 3:
        model_name = sys.argv[1]
        base_url = sys.argv[2]
        has_api_key = len(sys.argv) > 3 and sys.argv[3].lower() in ("true", "1", "yes")

        await test_custom_model(model_name, base_url, has_api_key)
    else:
        print("\n" + "=" * 60)
        print("💡 提示: 可以使用以下命令测试自定义模型:")
        print("   python test_model_validation.py <模型名称> <API地址> [是否有APIKey]")
        print("\n   示例:")
        print('   python test_model_validation.py gpt-4 https://api.openai.com/v1 true')
        print('   python test_model_validation.py deepseek-chat https://api.deepseek.com/v1 true')

    print("\n" + "=" * 60)
    print("测试完成!")


if __name__ == "__main__":
    asyncio.run(main())
