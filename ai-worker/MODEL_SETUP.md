# AI Worker 模型配置指南

## 快速开始

### 1. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cd ai-worker
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API 配置：

```bash
MODEL_API_BASE_URL=https://api.clawdrouter.com/v1
MODEL_API_KEY=your-api-key-here
TEXT_MODEL_NAME=gpt-5.5
```

### 2. 快速测试

运行快速测试脚本验证连接：

```bash
python quick_test.py
```

### 3. 使用示例

#### 直接使用 OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.clawdrouter.com/v1"
)

# 同步调用
response = client.responses.create(
    model="gpt-5.5",
    input=[{"role": "user", "content": "用三句话解释量子计算"}],
    stream=False
)
print(response.output_text)

# 流式调用
stream = client.responses.create(
    model="gpt-5.5",
    input=[{"role": "user", "content": "用三句话解释量子计算"}],
    stream=True
)
for event in stream:
    print(event)
```

#### 使用项目 Provider

```python
from app.config import get_settings
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.providers.base import ProviderDescriptor, ProviderType

settings = get_settings()

descriptor = ProviderDescriptor(
    provider_type=ProviderType.TEXT,
    provider_name="text-provider",
    model_name="gpt-5.5",
    base_url=settings.model_api_base_url,
    configured=True,
    required_env_keys=[],
    configured_env_keys=[],
    note="示例",
)

provider = OpenAICompatibleProvider(descriptor, settings)

# 同步调用
result = provider.chat("用三句话解释量子计算")

# 流式调用
for event in provider.chat("解释人工智能", stream=True):
    print(event)
```

## 环境变量说明

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `MODEL_API_BASE_URL` | API 基础地址 | `https://api.clawdrouter.com/v1` |
| `MODEL_API_KEY` | API 密钥 | `your-api-key` |
| `MODEL_TIMEOUT_SECONDS` | 超时时间（秒） | `60` |
| `TEXT_MODEL_NAME` | 文本模型名称 | `gpt-5.5` |
| `VISION_MODEL_NAME` | 视觉模型名称 | `gpt-5.5` |
| `MULTIMODAL_MODEL_NAME` | 多模态模型名称 | `gpt-5.5` |

## 支持的模型类型

- **TEXT** - 文本对话、评价生成
- **VISION** - 图像理解、OCR
- **SPEECH** - 音频转录、ASR
- **MULTIMODAL** - 多模态融合分析
- **OCR** - 专用文字识别
- **ASR** - 专用语音识别

## 运行示例

```bash
# 运行完整示例
python examples/model_usage.py

# 运行快速测试
python quick_test.py
```

## 常见问题

### 1. 连接超时

检查网络连接和 API 地址是否正确。

### 2. 认证失败

确认 `MODEL_API_KEY` 是否正确设置。

### 3. 模型不存在

确认 `MODEL_NAME` 是否为 API 支持的模型。
