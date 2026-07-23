# 作品分析使用指南

本文档介绍如何使用作品分析功能。

## 功能概述

作品分析模块支持以下功能：

- ✅ 作品元数据提取（时长、分辨率、编码等）
- ✅ 关键帧提取（间隔/场景变化/混合方法）
- ✅ 语音识别（Whisper，支持中英文）
- ✅ 内容分析（主题识别、摘要生成）
- ✅ 技术质量评估

## 快速开始

### 1. 启动服务

```bash
# 启动 AI Worker
cd ai-worker
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# 启动后端
cd backend
mvn spring-boot:run

# 启动前端
cd frontend
npm run dev
```

### 2. 使用示例脚本

```bash
cd ai-worker

# 通过 API 测试分析
curl -X POST http://localhost:8000/parse/tasks \
  -H "Content-Type: application/json" \
  -d '{"file_url": "http://minio:9000/coursework-submissions/test.mp4"}'
```

### 3. 使用 API

#### 提交分析任务

```bash
# 同步分析（等待完成）
curl -X POST http://localhost:8001/work/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "demo.mp4",
    "file_path": "/path/to/video.mp4",
    "options": {
      "extract_keyframes": true,
      "keyframe_method": "hybrid",
      "max_keyframes": 50,
      "transcribe_audio": true,
      "analyze_content": true
    }
  }'

# 异步分析（立即返回）
curl -X POST http://localhost:8001/work/analyze/async \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "demo.mp4",
    "file_path": "/path/to/video.mp4"
  }'
```

#### 查询任务状态

```bash
# 获取完整结果
curl http://localhost:8001/work/tasks/{task_id}

# 仅获取进度
curl http://localhost:8001/work/tasks/{task_id}/progress

# 列出所有任务
curl http://localhost:8001/work/tasks
```

## API 详细说明

### POST /work/analyze

提交作品分析任务并等待完成。

**请求参数**：

```json
{
  "task_id": "可选，自动生成",
  "file_name": "视频文件名",
  "file_path": "视频文件路径（服务器本地路径）",
  "options": {
    "extract_keyframes": true,
    "keyframe_method": "hybrid",
    "max_keyframes": 50,
    "scene_threshold": 0.3,
    "min_interval_seconds": 5.0,
    "transcribe_audio": true,
    "whisper_language": null,
    "analyze_content": true,
    "ocr_enabled": true
  }
}
```

**响应示例**：

```json
{
  "task_id": "xxx",
  "file_name": "demo.mp4",
  "status": "completed",
  "progress": 100,
  "metadata": {
    "duration_seconds": 180.5,
    "width": 1920,
    "height": 1080,
    "fps": 30.0,
    "codec": "h264",
    "bitrate": 5000000,
    "file_size": 52428800,
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "has_audio": true,
    "audio_codec": "aac",
    "audio_sample_rate": 44100
  },
  "keyframes": [
    {
      "frame_id": "xxx",
      "timestamp_seconds": 0.0,
      "frame_index": 0,
      "scene_change_score": null,
      "image_path": "/tmp/xxx/keyframes/frame_0000.jpg"
    }
  ],
  "audio_analysis": {
    "transcription": [
      {
        "start_time": 0.0,
        "end_time": 5.2,
        "text": "大家好，今天我们来讨论...",
        "confidence": -0.3
      }
    ],
    "total_speech_duration": 165.2,
    "average_speech_rate": 185.5,
    "detected_language": "zh",
    "clarity_score": 0.92
  },
  "content_analysis": {
    "overall_topic": "机器学习算法介绍",
    "summary": "本视频介绍了三种常见的机器学习算法...",
    "key_points": [
      "线性回归的基本原理",
      "决策树的构建过程",
      "神经网络的应用场景"
    ],
    "keywords": ["机器学习", "算法", "人工智能"]
  },
  "technical_quality": {
    "video_quality": "高清",
    "audio_quality": "清晰",
    "stability": "稳定",
    "overall_score": 95
  },
  "processing_time_ms": 45000,
  "warnings": []
}
```

### POST /work/analyze/async

异步提交分析任务，立即返回任务 ID。

**响应示例**：

```json
{
  "task_id": "xxx",
  "status": "submitted",
  "message": "任务已提交，请通过 /work/tasks/{task_id} 查询进度"
}
```

### GET /work/tasks/{task_id}

获取任务状态和完整结果。

### GET /work/tasks/{task_id}/progress

仅获取任务进度。

**响应示例**：

```json
{
  "task_id": "xxx",
  "status": "transcribing",
  "progress": 60,
  "current_stage": "transcribing"
}
```

### GET /work/tasks

列出所有任务。

**响应示例**：

```json
{
  "total": 5,
  "tasks": [
    {
      "task_id": "xxx",
      "file_name": "demo.mp4",
      "status": "completed",
      "progress": 100
    }
  ]
}
```

### GET /work/capabilities

获取支持的功能和限制。

**响应示例**：

```json
{
  "supported_formats": ["mp4", "avi", "mov", "mkv", "webm"],
  "max_duration_seconds": 1800,
  "max_file_size_mb": 500,
  "features": {
    "metadata_extraction": true,
    "keyframe_extraction": {
      "methods": ["interval", "scene_change", "hybrid"],
      "default_method": "hybrid",
      "max_frames": 100
    },
    "audio_transcription": {
      "enabled": true,
      "languages": ["zh", "en"],
      "auto_detect": true
    },
    "content_analysis": {
      "enabled": true,
      "topic_recognition": true,
      "keyword_extraction": true,
      "summarization": true
    }
  }
}
```

## 配置选项

### 环境变量

```bash
# Whisper 配置
WHISPER_MODEL=whisper-1
WHISPER_PRIMARY_LANGUAGE=zh

# 视频处理配置
VIDEO_MAX_DURATION_SECONDS=1800
VIDEO_MAX_SIZE_MB=500

# 模型配置
VISION_MODEL=gpt-4v
TEXT_MODEL=gpt-4
```

### 关键帧提取方法

| 方法 | 说明 | 适用场景 |
|------|------|----------|
| `interval` | 固定间隔提取 | 变化均匀的视频 |
| `scene_change` | 场景变化检测 | 演示、教学视频 |
| `hybrid` | 混合策略（推荐） | 大多数场景 |

### 分析选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `extract_keyframes` | bool | true | 是否提取关键帧 |
| `keyframe_method` | string | "hybrid" | 提取方法 |
| `max_keyframes` | int | 50 | 最大帧数 |
| `scene_threshold` | float | 0.3 | 场景变化阈值 |
| `transcribe_audio` | bool | true | 是否转录音频 |
| `whisper_language` | string | null | 语言（null=自动检测） |
| `analyze_content` | bool | true | 是否分析内容 |

## 前端使用

### 访问作品分析页面

1. 启动前端服务：`cd frontend && npm run dev`
2. 访问 `http://localhost:5173`
3. 登录管理员账号
4. 进入「作品分析」模块

### 功能说明

- **任务列表**：查看所有分析任务
- **任务详情**：查看单个任务的详细结果
- **关键帧预览**：浏览提取的关键帧
- **语音转录**：查看语音识别结果
- **内容分析**：查看主题、摘要、关键点

## 最佳实践

### 1. 视频准备

- 使用常见格式（MP4 推荐）
- 时长控制在 30 分钟以内
- 音频清晰，背景噪音小
- 分辨率建议 720p 或 1080p

### 2. 批量处理

```python
import asyncio
import httpx

async def batch_analyze(video_paths: list[str]):
    async with httpx.AsyncClient() as client:
        tasks = []
        for path in video_paths:
            response = await client.post(
                "http://localhost:8001/work/analyze/async",
                json={
                    "file_name": path.split("/")[-1],
                    "file_path": path,
                },
            )
            tasks.append(response.json()["task_id"])

        # 等待所有任务完成
        for task_id in tasks:
            while True:
                status = await client.get(f"http://localhost:8001/work/tasks/{task_id}")
                if status.json()["status"] in ["completed", "failed"]:
                    break
                await asyncio.sleep(1)
```

### 3. 错误处理

```python
try:
    result = await analyze_video(request)
    if result.status == "failed":
        print(f"分析失败: {result.error}")
    elif result.warnings:
        print(f"警告: {result.warnings}")
except httpx.HTTPStatusError as e:
    if e.response.status_code == 400:
        print("请求参数错误")
    elif e.response.status_code == 500:
        print("服务器内部错误")
```

## 常见问题

### Q: 作品分析需要多长时间？

A: 取决于视频时长和复杂度：
- 5 分钟视频：约 1-2 分钟
- 15 分钟视频：约 3-5 分钟
- 30 分钟视频：约 5-8 分钟

### Q: 支持哪些语言？

A: 当前支持中文和英文，自动检测语言。

### Q: 视频超过 30 分钟怎么办？

A: 系统会自动分析前 30 分钟，并在警告中提示。

### Q: 如何提高语音识别准确率？

A: 建议：
- 使用清晰的音频
- 减少背景噪音
- 说话清晰，语速适中

### Q: 关键帧提取不理想怎么办？

A: 可以调整参数：
- `scene_threshold`：降低阈值提取更多帧
- `max_keyframes`：增加最大帧数
- `keyframe_method`：尝试不同的提取方法

## 故障排查

### 问题：分析失败

**可能原因**：
1. FFmpeg 未安装
2. 文件路径错误
3. 文件格式不支持
4. 磁盘空间不足

**解决方案**：
```bash
# 检查 FFmpeg
ffmpeg -version

# 检查文件
ls -la /path/to/video.mp4

# 检查磁盘空间
df -h
```

### 问题：语音识别失败

**可能原因**：
1. OpenAI API Key 未配置
2. 网络连接问题
3. 视频无音频轨道

**解决方案**：
```bash
# 检查环境变量
echo $MODEL_API_KEY

# 测试网络
curl https://api.openai.com/v1/models
```

## 下一步

- 支持更多视频格式
- 优化关键帧提取算法
- 增加本地 Whisper 模型支持
- 支持视频分段处理
- 增加更多语言支持
