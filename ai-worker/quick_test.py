"""快速测试模型连接

直接使用 OpenAI SDK 测试 API 连接
"""

from openai import OpenAI

# 配置
client = OpenAI(
    api_key="your-api-key-here",  # 替换为你的 API Key
    base_url="https://api.clawdrouter.com/v1"
)

# 测试调用
print("正在测试模型连接...")
print("=" * 50)

try:
    stream = client.responses.create(
        model="gpt-5.5",
        input=[{"role": "user", "content": "用三句话解释量子计算"}],
        stream=True
    )

    print("流式回复:")
    for event in stream:
        print(event)

    print("=" * 50)
    print("✅ 连接成功!")

except Exception as e:
    print(f"❌ 连接失败: {e}")
