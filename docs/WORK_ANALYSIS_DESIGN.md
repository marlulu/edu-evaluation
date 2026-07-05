# 作品分析技术设计方案

本文档讨论如何在 AI 课程作业评价系统中实现作品分析功能。

## 1. 需求分析

### 1.1 业务场景

| 场景 | 说明 | 分析重点 |
|------|------|----------|
| 课程演示 | 学生录制的算法演示、实验操作 | 操作步骤、讲解清晰度 |
| 项目展示 | 项目介绍、功能演示 | 内容完整性、表达能力 |
| 口头报告 | 学术报告、读书分享 | 语音质量、逻辑连贯性 |
| 实验记录 | 实验过程录制 | 操作规范、安全意识 |

### 1.2 分析维度

```
作品分析
├── 视觉分析（画面内容）
│   ├── 关键帧提取
│   ├── 场景识别
│   ├── 文字识别（OCR）
│   └── 动作分析
├── 音频分析（语音内容）
│   ├── 语音转文字
│   ├── 语速分析
│   ├── 清晰度分析
│   └── 情感分析
├── 结构分析（视频组织）
│   ├── 时长分析
│   ├── 分段识别
│   ├── 节奏分析
│   └── 完整性检查
└── 内容分析（语义理解）
    ├── 主题识别
    ├── 关键词提取
    ├── 逻辑分析
    └── 质量评估
```

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端展示层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 任务状态 │  │ 进度显示 │  │ 结果预览 │  │ 审核界面 │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        后端编排层                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  视频解析任务调度器                         │  │
│  │  - 任务创建与状态管理                                      │  │
│  │  - 分段上传协调                                           │  │
│  │  - 结果聚合与持久化                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AI Worker 层                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    视频解析管线                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │
│  │  │ 元数据  │ │ 关键帧  │ │ 音频    │ │ 内容    │      │   │
│  │  │ 提取器  │ │ 提取器  │ │ 分析器  │ │ 分析器  │      │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    模型服务层                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ 视觉模型 │ │ 语音模型 │ │ 文本模型 │ │ 多模态   │  │   │
│  │  │ (GPT-4V) │ │ (Whisper)│ │ (GPT-4)  │ │ (GPT-4o) │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 处理流程

```
┌──────────────┐
│ 视频文件上传 │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────────────────────────────────┐
│ 预处理阶段   │ ──▶ │ 1. 验证文件格式和大小                     │
│              │     │ 2. 提取基础元数据（时长、分辨率、编码）    │
│              │     │ 3. 计算文件哈希                           │
└──────┬───────┘     └──────────────────────────────────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────────────────────────────────┐
│ 并行分析阶段 │ ──▶ │ 分支1: 关键帧提取 → 图像分析             │
│              │     │ 分支2: 音频提取 → 语音分析                │
│              │     │ 分支3: 字幕提取 → 文本分析                │
└──────┬───────┘     └──────────────────────────────────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────────────────────────────────┐
│ 融合分析阶段 │ ──▶ │ 1. 对齐时间戳                            │
│              │     │ 2. 关联视觉和语音内容                     │
│              │     │ 3. 生成综合分析结果                       │
└──────┬───────┘     └──────────────────────────────────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────────────────────────────────┐
│ 结果输出阶段 │ ──▶ │ 1. 结构化特征数据                        │
│              │     │ 2. 可追溯的证据单元                       │
│              │     │ 3. 质量评估指标                           │
└──────────────┘     └──────────────────────────────────────────┘
```

## 3. 核心功能实现

### 3.1 作品元数据提取

```python
# ai-worker/app/modules/content_parsing/work/metadata.py

import subprocess
import json
from dataclasses import dataclass
from typing import Optional

@dataclass
class VideoMetadata:
    """作品元数据"""
    duration_seconds: float
    width: int
    height: int
    fps: float
    codec: str
    bitrate: int
    file_size: int
    format_name: str
    has_audio: bool
    audio_codec: Optional[str] = None
    audio_sample_rate: Optional[int] = None


def extract_metadata(file_path: str) -> VideoMetadata:
    """使用 ffprobe 提取作品元数据"""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        file_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)

    # 解析视频流
    video_stream = next(
        (s for s in data["streams"] if s["codec_type"] == "video"),
        None
    )
    audio_stream = next(
        (s for s in data["streams"] if s["codec_type"] == "audio"),
        None
    )

    return VideoMetadata(
        duration_seconds=float(data["format"]["duration"]),
        width=int(video_stream["width"]) if video_stream else 0,
        height=int(video_stream["height"]) if video_stream else 0,
        fps=eval(video_stream["r_frame_rate"]) if video_stream else 0,
        codec=video_stream["codec_name"] if video_stream else "",
        bitrate=int(data["format"]["bit_rate"]),
        file_size=int(data["format"]["size"]),
        format_name=data["format"]["format_name"],
        has_audio=audio_stream is not None,
        audio_codec=audio_stream["codec_name"] if audio_stream else None,
        audio_sample_rate=int(audio_stream["sample_rate"]) if audio_stream else None,
    )
```

### 3.2 关键帧提取

```python
# ai-worker/app/modules/content_parsing/work/keyframes.py

import subprocess
import os
from pathlib import Path
from typing import List

@dataclass
class Keyframe:
    """关键帧信息"""
    timestamp_seconds: float
    frame_path: str
    frame_index: int
    scene_change_score: float


def extract_keyframes(
    video_path: str,
    output_dir: str,
    method: str = "scene_change",
    threshold: float = 0.3,
    max_frames: int = 50,
) -> List[Keyframe]:
    """提取视频关键帧

    Args:
        video_path: 视频文件路径
        output_dir: 输出目录
        method: 提取方法 ("scene_change" | "interval" | "iframes")
        threshold: 场景变化阈值 (0-1)
        max_frames: 最大帧数

    Returns:
        关键帧列表
    """
    os.makedirs(output_dir, exist_ok=True)

    if method == "scene_change":
        return _extract_by_scene_change(video_path, output_dir, threshold, max_frames)
    elif method == "interval":
        return _extract_by_interval(video_path, output_dir, max_frames)
    elif method == "iframes":
        return _extract_iframes(video_path, output_dir, max_frames)
    else:
        raise ValueError(f"Unknown method: {method}")


def _extract_by_scene_change(
    video_path: str,
    output_dir: str,
    threshold: float,
    max_frames: int,
) -> List[Keyframe]:
    """基于场景变化的关键帧提取"""
    # 使用 ffmpeg 的场景变化检测
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"select='gt(scene,{threshold})'",
        "-vsync", "vfr",
        "-frame_pts", "1",
        os.path.join(output_dir, "frame_%04d.jpg"),
    ]

    # 同时输出场景变化分数
    stats_cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-f", "null",
        "-"
    ]

    # 执行提取...
    # 解析输出获取时间戳和分数
    # 返回关键帧列表
    pass


def _extract_by_interval(
    video_path: str,
    output_dir: str,
    max_frames: int,
) -> List[Keyframe]:
    """按固定间隔提取关键帧"""
    # 获取视频时长
    duration = _get_duration(video_path)
    interval = duration / max_frames

    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"fps=1/{interval}",
        "-frames:v", str(max_frames),
        os.path.join(output_dir, "frame_%04d.jpg"),
    ]

    # 执行提取...
    pass


def _extract_iframes(
    video_path: str,
    output_dir: str,
    max_frames: int,
) -> List[Keyframe]:
    """提取 I 帧（关键帧）"""
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", "select='eq(pict_type,I)'",
        "-vsync", "vfr",
        "-frames:v", str(max_frames),
        os.path.join(output_dir, "iframe_%04d.jpg"),
    ]

    # 执行提取...
    pass
```

### 3.3 音频提取与分析

```python
# ai-worker/app/modules/content_parsing/audio/analyzer.py

import subprocess
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class AudioSegment:
    """音频片段"""
    start_time: float
    end_time: float
    text: str
    confidence: float
    speaker_id: Optional[str] = None

@dataclass
class AudioAnalysis:
    """音频分析结果"""
    transcription: List[AudioSegment]
    total_speech_duration: float
    average_speech_rate: float  # 字/分钟
    volume_db: float
    clarity_score: float  # 0-1
    pause_count: int
    average_pause_duration: float


def extract_audio(video_path: str, output_path: str) -> str:
    """从视频中提取音频"""
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vn",  # 不包含视频
        "-acodec", "pcm_s16le",  # WAV 格式
        "-ar", "16000",  # 16kHz 采样率
        "-ac", "1",  # 单声道
        output_path
    ]
    subprocess.run(cmd, check=True)
    return output_path


def transcribe_audio(audio_path: str, model: str = "whisper-1") -> List[AudioSegment]:
    """使用 Whisper 进行语音识别"""
    # 调用 OpenAI Whisper API 或本地模型
    # 返回带时间戳的文字转录
    pass


def analyze_speech_rate(segments: List[AudioSegment]) -> float:
    """分析语速（字/分钟）"""
    total_chars = sum(len(seg.text) for seg in segments)
    total_duration = sum(seg.end_time - seg.start_time for seg in segments)

    if total_duration == 0:
        return 0

    return (total_chars / total_duration) * 60


def analyze_clarity(segments: List[AudioSegment]) -> float:
    """分析语音清晰度（基于置信度）"""
    if not segments:
        return 0

    avg_confidence = sum(seg.confidence for seg in segments) / len(segments)
    return avg_confidence
```

### 3.4 字幕/文字识别

```python
# ai-worker/app/modules/content_parsing/work/subtitles.py

import subprocess
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class TextRegion:
    """文字区域"""
    text: str
    timestamp_seconds: float
    bounding_box: tuple[int, int, int, int]  # x, y, w, h
    confidence: float
    source: str  # "subtitle" | "on_screen" | "burned_in"


def extract_subtitles(video_path: str) -> List[TextRegion]:
    """提取视频字幕（软字幕）"""
    # 使用 ffmpeg 提取内嵌字幕流
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-map", "0:s:0",  # 第一个字幕流
        "-f", "srt",
        "-"
    ]

    # 解析 SRT 格式
    # 返回带时间戳的字幕列表
    pass


def extract_on_screen_text(
    video_path: str,
    timestamps: List[float],
    ocr_model: str = "gpt-4v",
) -> List[TextRegion]:
    """提取视频画面中的文字（OCR）"""
    # 1. 提取指定时间戳的帧
    # 2. 使用 OCR 模型识别文字
    # 3. 返回文字区域信息
    pass
```

### 3.5 视频内容理解

```python
# ai-worker/app/modules/content_parsing/work/content_analyzer.py

from dataclasses import dataclass
from typing import List, Optional

@dataclass
class VideoScene:
    """视频场景"""
    start_time: float
    end_time: float
    description: str
    key_objects: List[str]
    scene_type: str  # "indoor" | "outdoor" | "screen_recording" | "presentation"

@dataclass
class VideoTopic:
    """视频主题"""
    topic: str
    confidence: float
    keywords: List[str]
    timestamp_range: tuple[float, float]

@dataclass
class ContentAnalysis:
    """内容分析结果"""
    scenes: List[VideoScene]
    topics: List[VideoTopic]
    overall_topic: str
    summary: str
    key_points: List[str]


def analyze_video_content(
    keyframes: List[dict],
    transcription: List[dict],
    model: str = "gpt-4o",
) -> ContentAnalysis:
    """分析视频内容

    使用多模态模型分析：
    1. 关键帧图像
    2. 语音转录文本
    3. 元数据信息
    """
    # 构建提示词
    prompt = """
    请分析以下视频内容：

    【关键帧描述】
    {keyframes}

    【语音转录】
    {transcription}

    请提供：
    1. 视频的主要场景
    2. 讨论的主题
    3. 关键要点
    4. 内容总结
    """

    # 调用多模态模型
    # 返回结构化分析结果
    pass
```

## 4. 数据模型设计

### 4.1 视频解析任务

```python
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class VideoParseTask(BaseModel):
    """视频解析任务"""
    task_id: str
    file_id: str
    file_name: str
    file_path: str
    status: str  # "pending" | "processing" | "completed" | "failed"
    progress: float  # 0-100
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

class VideoParseResult(BaseModel):
    """视频解析结果"""
    task_id: str
    file_id: str

    # 元数据
    duration_seconds: float
    width: int
    height: int
    fps: float
    codec: str
    file_size: int

    # 关键帧
    keyframes: List[dict]

    # 音频分析
    transcription: List[dict]
    speech_rate: float
    clarity_score: float

    # 内容分析
    scenes: List[dict]
    topics: List[dict]
    summary: str
    key_points: List[str]

    # 质量指标
    technical_quality: dict
    content_quality: dict

    # 证据单元
    evidence_units: List[dict]
```

### 4.2 证据追溯

```python
class VideoEvidence(BaseModel):
    """视频证据单元"""
    evidence_id: str
    evidence_type: str  # "frame" | "audio_segment" | "scene" | "text"

    # 时间定位
    start_time: float
    end_time: float

    # 内容
    content: str
    description: str

    # 来源
    source_type: str  # "visual" | "audio" | "subtitle"
    source_path: Optional[str] = None  # 关键帧图片路径

    # 评分关联
    rubric_dimension: Optional[str] = None
    score_relevance: float  # 0-1
```

## 5. 技术选型

### 5.1 核心依赖

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 视频处理 | FFmpeg | 元数据提取、音频分离、关键帧提取 |
| 语音识别 | OpenAI Whisper | 语音转文字 |
| 图像理解 | GPT-4V / GPT-4o | 关键帧内容分析 |
| 视频理解 | GPT-4o | 多模态内容分析 |
| 任务队列 | Celery + Redis | 异步任务处理 |
| 文件存储 | MinIO | 视频和关键帧存储 |

### 5.2 环境变量配置

```bash
# 视频处理配置
VIDEO_MAX_SIZE_MB=500
VIDEO_ALLOWED_FORMATS=mp4,avi,mov,mkv,webm
VIDEO_KEYFRAME_MAX_COUNT=50
VIDEO_KEYFRAME_METHOD=scene_change

# 语音识别配置
WHISPER_MODEL=whisper-1
WHISPER_LANGUAGE=zh

# 分析模型配置
VIDEO_ANALYSIS_MODEL=gpt-4o
VISION_MODEL=gpt-4v
```

## 6. API 设计

### 6.1 视频解析接口

```python
# 创建视频解析任务
POST /api/content-parsing/work/tasks
{
    "file_id": "xxx",
    "file_name": "demo.mp4",
    "options": {
        "extract_keyframes": true,
        "keyframe_method": "scene_change",
        "max_keyframes": 50,
        "transcribe_audio": true,
        "analyze_content": true,
        "ocr_enabled": true
    }
}

# 查询任务状态
GET /api/content-parsing/work/tasks/{task_id}

# 获取解析结果
GET /api/content-parsing/work/tasks/{task_id}/result

# 获取关键帧
GET /api/content-parsing/work/tasks/{task_id}/keyframes/{frame_id}

# 获取转录文本
GET /api/content-parsing/work/tasks/{task_id}/transcription
```

### 6.2 响应示例

```json
{
    "task_id": "task_001",
    "file_id": "file_001",
    "status": "completed",
    "progress": 100,
    "result": {
        "duration_seconds": 180.5,
        "width": 1920,
        "height": 1080,
        "fps": 30.0,
        "keyframe_count": 25,
        "transcription_duration": 165.2,
        "speech_rate": 185.5,
        "clarity_score": 0.92,
        "overall_topic": "机器学习算法演示",
        "summary": "本视频演示了三种常见的机器学习算法...",
        "key_points": [
            "介绍了线性回归的基本原理",
            "演示了决策树的构建过程",
            "对比了不同算法的优缺点"
        ],
        "technical_quality": {
            "video_quality": "高清",
            "audio_quality": "清晰",
            "stability": "稳定"
        }
    }
}
```

## 7. 实现计划

### 7.1 第一阶段：基础功能（2周）

- [ ] 作品元数据提取
- [ ] 音频提取与 Whisper 转录
- [ ] 基础关键帧提取（间隔提取）
- [ ] 简单的内容总结

### 7.2 第二阶段：增强功能（2周）

- [ ] 场景变化检测
- [ ] OCR 文字识别
- [ ] 语速和清晰度分析
- [ ] 证据单元生成

### 7.3 第三阶段：高级功能（2周）

- [ ] 多模态融合分析
- [ ] 场景分类
- [ ] 主题识别
- [ ] 质量评估

### 7.4 第四阶段：优化完善（1周）

- [ ] 性能优化
- [ ] 错误处理
- [ ] 监控告警
- [ ] 文档完善

## 8. 注意事项

### 8.1 性能考虑

- 大视频文件需要分段处理
- 关键帧提取数量需要限制
- 并行处理独立分析任务
- 使用缓存避免重复计算

### 8.2 成本控制

- 限制视频时长上限
- 控制 API 调用次数
- 使用本地模型降低费用
- 缓存分析结果

### 8.3 错误处理

- 视频格式不支持
- 音频提取失败
- 语音识别错误
- 模型调用超时

### 8.4 隐私安全

- 视频文件加密存储
- 临时文件及时清理
- 访问权限控制
- 审计日志记录

## 9. 待讨论问题

1. **视频时长上限**：建议设置多少？
   - 建议：≤ 30 分钟
   - 超长视频如何处理？

2. **关键帧提取策略**：
   - 场景变化 vs 固定间隔？
   - 最大帧数限制？

3. **语音识别语言**：
   - 仅中文？还是多语言？
   - 混合语言如何处理？

4. **模型选择**：
   - 使用云端 API 还是本地模型？
   - 成本和质量如何平衡？

5. **实时性要求**：
   - 是否需要实时分析？
   - 可接受的处理时间？

6. **结果存储**：
   - 保留原始视频多久？
   - 关键帧如何存储？
