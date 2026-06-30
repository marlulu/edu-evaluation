"""模型调用示例

使用 OpenAI 兼容 API 进行对话调用
"""

import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.providers.base import ProviderDescriptor, ProviderType


def main():
    # 加载配置
    settings = get_settings()

    # 创建 Provider 描述
    descriptor = ProviderDescriptor(
        provider_type=ProviderType.TEXT,
        provider_name="text-provider",
        model_name=settings.text_model_name or "gpt-5.5",
        base_url=settings.model_api_base_url,
        configured=bool(settings.model_api_base_url and settings.model_api_key),
        required_env_keys=["MODEL_API_BASE_URL", "TEXT_MODEL_NAME"],
        configured_env_keys=[],
        note="示例文本模型",
    )

    # 创建 Provider 实例
    provider = OpenAICompatibleProvider(descriptor, settings)

    print("=" * 50)
    print("模型调用示例")
    print("=" * 50)
    print(f"API 地址: {settings.model_api_base_url}")
    print(f"模型名称: {descriptor.model_name}")
    print("=" * 50)

    # 方式1: 同步调用
    print("\n【同步调用】")
    try:
        result = provider.chat("用三句话解释量子计算")
        print(f"回复: {result}")
    except Exception as e:
        print(f"调用失败: {e}")

    # 方式2: 流式调用
    print("\n【流式调用】")
    try:
        stream = provider.chat(
            "用三句话解释人工智能",
            stream=True,
        )
        print("回复: ", end="")
        for event in stream:
            # 根据实际返回的事件格式处理
            print(event, end="", flush=True)
        print()
    except Exception as e:
        print(f"调用失败: {e}")

    # 方式3: 带系统提示的调用
    print("\n【带系统提示的调用】")
    try:
        result = provider.chat(
            "解释什么是机器学习",
            system_prompt="你是一位人工智能专家，请用简单易懂的语言解释概念。",
        )
        print(f"回复: {result}")
    except Exception as e:
        print(f"调用失败: {e}")


if __name__ == "__main__":
    main()
