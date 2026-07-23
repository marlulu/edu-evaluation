# 模型配置指南

本文档说明如何配置 AI 模型，包括视频分析、语音识别、内容分析等功能。

## 配置位置

模型配置在 `ai-worker/.env` 文件中设置。

```bash
# 复制示例配置
cd ai-worker
cp .env.example .env
```

## 配置项说明

### 基础配置

```bash
# API 提供商驱动（目前只支持 openai-compatible）
MODEL_PROVIDER_DRIVER=openai-compatible

# API 基础地址
MODEL_API_BASE_URL=https://api.clawdrouter.com/v1

# API 密钥
MODEL_API_KEY=your-api-key-here

# 请求超时时间（秒）
MODEL_TIMEOUT_SECONDS=60
```

### 各功能模型配置

| 配置项 | 用途 | 示例值 |
|--------|------|--------|
| `VISION_MODEL_NAME` | 图像理解、关键帧分析 | `gpt-4v` |
| `AUDIO_MODEL_NAME` | 语音识别（Whisper） | `whisper-1` |
| `TEXT_MODEL_NAME` | 文本分析、内容总结 | `gpt-4` |
| `MULTIMODAL_MODEL_NAME` | 多模态融合分析 | `gpt-4o` |
| `OCR_MODEL_NAME` | 文字识别 | `gpt-4v` |
| `ASR_MODEL_NAME` | 语音识别（备选） | `whisper-1` |

## 完整配置示例

### 方案一：使用 OpenAI

```bash
# 基础配置
MODEL_PROVIDER_DRIVER=openai-compatible
MODEL_API_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=sk-your-openai-api-key
MODEL_TIMEOUT_SECONDS=60

# 各功能模型
VISION_PROVIDER_NAME=openai-compatible
VISION_MODEL_NAME=gpt-4-vision-preview

SPEECH_PROVIDER_NAME=openai-compatible
AUDIO_MODEL_NAME=whisper-1

TEXT_PROVIDER_NAME=openai-compatible
TEXT_MODEL_NAME=gpt-4

MULTIMODAL_PROVIDER_NAME=openai-compatible
MULTIMODAL_MODEL_NAME=gpt-4o

OCR_PROVIDER_NAME=openai-compatible
OCR_MODEL_NAME=gpt-4-vision-preview

ASR_PROVIDER_NAME=openai-compatible
ASR_MODEL_NAME=whisper-1
```

### 方案二：使用 DeepSeek

```bash
# 基础配置
MODEL_PROVIDER_DRIVER=openai-compatible
MODEL_API_BASE_URL=https://api.deepseek.com/v1
MODEL_API_KEY=your-deepseek-api-key
MODEL_TIMEOUT_SECONDS=60

# 各功能模型
VISION_PROVIDER_NAME=openai-compatible
VISION_MODEL_NAME=deepseek-vision

SPEECH_PROVIDER_NAME=openai-compatible
AUDIO_MODEL_NAME=whisper-1

TEXT_PROVIDER_NAME=openai-compatible
TEXT_MODEL_NAME=deepseek-chat

MULTIMODAL_PROVIDER_NAME=openai-compatible
MULTIMODAL_MODEL_NAME=deepseek-chat

OCR_PROVIDER_NAME=openai-compatible
OCR_MODEL_NAME=deepseek-vision

ASR_PROVIDER_NAME=openai-compatible
ASR_MODEL_NAME=whisper-1
```

### 方案三：使用 ClawdRouter（多模型网关）

```bash
# 基础配置
MODEL_PROVIDER_DRIVER=openai-compatible
MODEL_API_BASE_URL=https://api.clawdrouter.com/v1
MODEL_API_KEY=your-clawdrouter-api-key
MODEL_TIMEOUT_SECONDS=60

# 各功能模型（使用不同模型）
VISION_PROVIDER_NAME=openai-compatible
VISION_MODEL_NAME=gpt-5.5

SPEECH_PROVIDER_NAME=openai-compatible
AUDIO_MODEL_NAME=gpt-5.5

TEXT_PROVIDER_NAME=openai-compatible
TEXT_MODEL_NAME=gpt-5.5

MULTIMODAL_PROVIDER_NAME=openai-compatible
MULTIMODAL_MODEL_NAME=gpt-5.5

OCR_PROVIDER_NAME=openai-compatible
OCR_MODEL_NAME=gpt-5.5

ASR_PROVIDER_NAME=openai-compatible
ASR_MODEL_NAME=gpt-5.5
```

### 方案四：使用本地模型（Ollama）

```bash
# 基础配置
MODEL_PROVIDER_DRIVER=openai-compatible
MODEL_API_BASE_URL=http://localhost:11434/v1
MODEL_API_KEY=ollama
MODEL_TIMEOUT_SECONDS=120

# 各功能模型
VISION_PROVIDER_NAME=openai-compatible
VISION_MODEL_NAME=llava

SPEECH_PROVIDER_NAME=openai-compatible
AUDIO_MODEL_NAME=whisper

TEXT_PROVIDER_NAME=openai-compatible
TEXT_MODEL_NAME=llama3

MULTIMODAL_PROVIDER_NAME=openai-compatible
MULTIMODAL_MODEL_NAME=llava

OCR_PROVIDER_NAME=openai-compatible
OCR_MODEL_NAME=llava

ASR_PROVIDER_NAME=openai-compatible
ASR_MODEL_NAME=whisper
```

## 功能与模型对应关系

| 功能 | 使用的模型 | 必需配置 |
|------|-----------|----------|
| **视频分析** | | |
| - 元数据提取 | FFmpeg（无需模型） | - |
| - 关键帧提取 | FFmpeg（无需模型） | - |
| - 语音识别 | `AUDIO_MODEL_NAME` | ✅ |
| - 内容分析 | `TEXT_MODEL_NAME` | ✅ |
| - 图像理解 | `VISION_MODEL_NAME` | 可选 |
| **图片分析** | | |
| - 图像识别 | `VISION_MODEL_NAME` | ✅ |
| - OCR 文字识别 | `OCR_MODEL_NAME` | 可选 |
| **文本分析** | | |
| - 文本理解 | `TEXT_MODEL_NAME` | ✅ |
| - 内容总结 | `TEXT_MODEL_NAME` | ✅ |
| **多模态分析** | | |
| - 融合分析 | `MULTIMODAL_MODEL_NAME` | ✅ |

## 配置验证

### 1. 检查配置是否生效

```bash
# 启动 AI Worker
cd ai-worker
uvicorn app.main:app --reload --port 8001

# 访问健康检查端点
curl http://localhost:8001/health
```

响应示例：
```json
{
  "service": "edu-evaluation-ai-worker",
  "status": "ok",
  "modelGatewayConfigured": true,
  "configuredSettings": {
    "environment": "local",
    "model_provider_driver": "openai-compatible",
    "model_api_base_url": "https://api.clawdrouter.com/v1",
    "configured_env_keys": ["MODEL_API_BASE_URL", "TEXT_MODEL_NAME", ...]
  }
}
```

### 2. 测试模型连接

```bash
# 快速测试
curl http://localhost:8001/models/test/quick

# 指定模型测试
curl -X POST http://localhost:8001/models/test \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "gpt-4",
    "base_url": "https://api.openai.com/v1",
    "api_key_configured": true
  }'
```

### 3. 测试作品分析

```bash
# 通过 API 测试
curl -X POST http://localhost:8000/parse/tasks \
  -H "Content-Type: application/json" \
  -d '{"file_url": "http://minio:9000/coursework-submissions/test.mp4"}'
```

## 配置优先级

配置的优先级从高到低：

1. **环境变量** - 直接设置的环境变量
2. **`.env` 文件** - 项目目录下的 `.env` 文件
3. **`.env.example` 默认值** - 示例文件中的默认值

## 常见问题

### Q: 如何知道配置是否生效？

A: 访问 `http://localhost:8001/health`，查看 `configuredSettings` 中的配置。

### Q: 不同功能可以使用不同的模型吗？

A: 可以。每个功能（视觉、语音、文本等）都可以配置不同的模型名称。

### Q: 模型配置修改后需要重启吗？

A: 需要。修改 `.env` 文件后需要重启 AI Worker 服务。

或者调用重新加载接口：
```bash
curl -X POST http://localhost:8001/reload-config
```

### Q: API Key 如何安全存储？

A: 建议：
1. 不要将 `.env` 文件提交到 Git
2. 使用环境变量或密钥管理服务
3. 定期轮换 API Key

### Q: 没有配置模型会怎样？

A: 部分功能将不可用：
- 语音识别：跳过，返回空结果
- 内容分析：跳过，返回基本结果
- 图像理解：跳过，返回基本元数据

## 环境变量参考

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `MODEL_PROVIDER_DRIVER` | 否 | `openai-compatible` | API 驱动类型 |
| `MODEL_API_BASE_URL` | 是 | - | API 基础地址 |
| `MODEL_API_KEY` | 是 | - | API 密钥 |
| `MODEL_TIMEOUT_SECONDS` | 否 | `60` | 超时时间 |
| `VISION_PROVIDER_NAME` | 否 | - | 视觉模型提供商 |
| `VISION_MODEL_NAME` | 否 | - | 视觉模型名称 |
| `SPEECH_PROVIDER_NAME` | 否 | - | 语音模型提供商 |
| `AUDIO_MODEL_NAME` | 否 | - | 语音模型名称 |
| `TEXT_PROVIDER_NAME` | 否 | - | 文本模型提供商 |
| `TEXT_MODEL_NAME` | 否 | - | 文本模型名称 |
| `MULTIMODAL_PROVIDER_NAME` | 否 | - | 多模态模型提供商 |
| `MULTIMODAL_MODEL_NAME` | 否 | - | 多模态模型名称 |
| `OCR_PROVIDER_NAME` | 否 | - | OCR 模型提供商 |
| `OCR_MODEL_NAME` | 否 | - | OCR 模型名称 |
| `ASR_PROVIDER_NAME` | 否 | - | ASR 模型提供商 |
| `ASR_MODEL_NAME` | 否 | - | ASR 模型名称 |

## 最佳实践

1. **分离配置**：不同环境（开发、测试、生产）使用不同的 `.env` 文件
2. **最小权限**：只配置需要的模型，减少不必要的 API 调用
3. **监控成本**：定期检查 API 使用量，设置预算告警
4. **备份配置**：将 `.env.example` 提交到 Git，但不要提交实际的 `.env`
5. **文档记录**：记录每个环境使用的模型和配置
