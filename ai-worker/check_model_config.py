"""检查模型配置是否正确"""

import os
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv


def load_env():
    """加载环境变量"""
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        return True
    return False


def check_config():
    """检查配置"""
    print("=" * 60)
    print("模型配置检查")
    print("=" * 60)

    # 加载 .env 文件
    env_loaded = load_env()
    if env_loaded:
        print("\n✅ 已加载 .env 文件")
    else:
        print("\n⚠️  未找到 .env 文件，将使用环境变量")
        print("   运行 'cp .env.example .env' 创建配置文件")

    # 检查基础配置
    print("\n[基础配置]")
    check_item("MODEL_API_BASE_URL", "API 基础地址", required=True)
    check_item("MODEL_API_KEY", "API 密钥", required=True, mask=True)
    check_item("MODEL_PROVIDER_DRIVER", "API 驱动", default="openai-compatible")
    check_item("MODEL_TIMEOUT_SECONDS", "超时时间", default="60")

    # 检查模型配置
    print("\n[模型配置]")
    check_item("VISION_MODEL_NAME", "视觉模型", required=False)
    check_item("AUDIO_MODEL_NAME", "语音模型", required=False)
    check_item("TEXT_MODEL_NAME", "文本模型", required=False)
    check_item("MULTIMODAL_MODEL_NAME", "多模态模型", required=False)
    check_item("OCR_MODEL_NAME", "OCR 模型", required=False)
    check_item("ASR_MODEL_NAME", "ASR 模型", required=False)

    # 总结
    print("\n" + "=" * 60)
    base_url = os.getenv("MODEL_API_BASE_URL")
    api_key = os.getenv("MODEL_API_KEY")

    if base_url and api_key:
        print("✅ 基础配置完成，可以开始使用")
        print(f"\n   API 地址: {base_url}")
        print(f"   API 密钥: {api_key[:6]}...{api_key[-4:] if len(api_key) > 10 else '***'}")

        # 显示配置的模型
        models = []
        for env_name, label in [
            ("VISION_MODEL_NAME", "视觉"),
            ("AUDIO_MODEL_NAME", "语音"),
            ("TEXT_MODEL_NAME", "文本"),
            ("MULTIMODAL_MODEL_NAME", "多模态"),
        ]:
            value = os.getenv(env_name)
            if value:
                models.append(f"{label}: {value}")

        if models:
            print(f"\n   已配置模型:")
            for model in models:
                print(f"     - {model}")
    else:
        print("❌ 基础配置不完整")
        if not base_url:
            print("   缺少: MODEL_API_BASE_URL")
        if not api_key:
            print("   缺少: MODEL_API_KEY")
        print("\n   请编辑 .env 文件添加配置")

    print("\n" + "=" * 60)


def check_item(env_name: str, label: str, required: bool = False, default: str = None, mask: bool = False):
    """检查单个配置项"""
    value = os.getenv(env_name)

    if value:
        if mask and len(value) > 10:
            display_value = f"{value[:6]}...{value[-4:]}"
        elif mask:
            display_value = "***"
        else:
            display_value = value

        if default and value == default:
            print(f"  ✅ {label}: {display_value} (默认)")
        else:
            print(f"  ✅ {label}: {display_value}")
    elif default:
        print(f"  ⚠️  {label}: 未设置 (将使用默认值: {default})")
    elif required:
        print(f"  ❌ {label}: 未设置 (必需)")
    else:
        print(f"  ⚪ {label}: 未设置 (可选)")


if __name__ == "__main__":
    check_config()
