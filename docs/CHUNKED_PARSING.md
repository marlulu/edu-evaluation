# 分段式传输解析

本文档介绍如何使用分段式传输解析功能处理大文件。

## 概述

分段式传输解析支持：

- **分段上传**：将大文件分割成小块逐段上传
- **流式解析**：实时处理接收到的数据流
- **进度追踪**：实时监控解析进度
- **错误恢复**：单个分段失败不影响整体处理

## API 端点

### 分段上传解析

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chunked/upload/init` | POST | 初始化分段上传 |
| `/chunked/upload/chunk` | POST | 上传单个分段 |
| `/chunked/parse/start` | POST | 开始解析 |
| `/chunked/parse/{session_id}/progress` | GET | 获取解析进度 |
| `/chunked/parse/{session_id}/result` | GET | 获取解析结果 |
| `/chunked/parse/{session_id}` | DELETE | 删除会话 |
| `/chunked/sessions` | GET | 列出所有会话 |

### 流式解析

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chunked/stream/parse` | POST | 初始化流式解析 |
| `/chunked/stream/{session_id}/chunk` | POST | 发送流式分段 |
| `/chunked/stream/{session_id}/content` | GET | 获取完整内容 |

## 使用流程

### 1. 分段上传解析流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  初始化上传  │ ──▶ │  分段上传   │ ──▶ │  开始解析   │ ──▶ │  获取结果   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

#### 步骤 1: 初始化

```python
import httpx

response = await client.post("/chunked/upload/init", json={
    "file_name": "large_file.pdf",
    "file_size": 10485760,  # 10MB
    "chunk_size": 1048576,  # 1MB
})

session_id = response.json()["session_id"]
```

#### 步骤 2: 分段上传

```python
import base64
import hashlib

for chunk_index, chunk_data in enumerate(chunks):
    # 计算校验和
    checksum = hashlib.md5(chunk_data).hexdigest()
    
    # Base64 编码
    chunk_b64 = base64.b64encode(chunk_data).decode("utf-8")
    
    # 上传
    await client.post("/chunked/upload/chunk", json={
        "session_id": session_id,
        "chunk_index": chunk_index,
        "chunk_data": chunk_b64,
        "checksum": checksum,
    })
```

#### 步骤 3: 开始解析

```python
await client.post("/chunked/parse/start", json={
    "session_id": session_id,
    "parse_options": {"extract_keywords": True},
})
```

#### 步骤 4: 轮询进度

```python
while True:
    progress = await client.get(f"/chunked/parse/{session_id}/progress")
    data = progress.json()
    
    print(f"进度: {data['progress_percent']}%")
    
    if data["status"] in ["completed", "failed"]:
        break
    
    await asyncio.sleep(0.5)
```

#### 步骤 5: 获取结果

```python
result = await client.get(f"/chunked/parse/{session_id}/result")
data = result.json()

print(f"状态: {data['status']}")
print(f"合并结果: {data['merged_result']}")
```

### 2. 流式解析流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  初始化会话  │ ──▶ │  发送分段   │ ──▶ │  获取结果   │
└─────────────┘     └─────────────┘     └─────────────┘
```

#### 步骤 1: 初始化流式会话

```python
response = await client.post("/chunked/stream/parse", json={
    "file_name": "stream_data.txt",
    "chunk_size": 8192,
})
```

#### 步骤 2: 逐段发送数据

```python
for i, chunk in enumerate(chunks):
    chunk_b64 = base64.b64encode(chunk).decode("utf-8")
    
    await client.post(f"/chunked/stream/{session_id}/chunk", json={
        "chunk_index": i,
        "data": chunk_b64,
        "is_last": i == len(chunks) - 1,
    })
```

#### 步骤 3: 获取完整内容

```python
content = await client.get(f"/chunked/stream/{session_id}/content")
data = content.json()

print(f"总字节数: {data['total_bytes']}")
print(f"内容预览: {data['text_preview']}")
```

## 配置参数

### 分段上传参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `file_name` | string | 必填 | 文件名 |
| `file_size` | int | 必填 | 文件大小（字节） |
| `chunk_size` | int | 1MB | 分段大小（1KB ~ 100MB） |
| `total_chunks` | int | 自动计算 | 总分段数 |

### 解析选项

| 参数 | 类型 | 说明 |
|------|------|------|
| `extract_keywords` | bool | 是否提取关键词 |
| `analyze_structure` | bool | 是否分析结构 |
| `generate_summary` | bool | 是否生成摘要 |

## 错误处理

### 常见错误

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 |
| 404 | 会话不存在 |
| 413 | 分段大小超限 |
| 500 | 服务器内部错误 |

### 错误响应格式

```json
{
    "detail": "错误描述"
}
```

## 最佳实践

### 1. 分段大小选择

- **小文件**（< 10MB）：64KB ~ 256KB
- **中等文件**（10MB ~ 100MB）：256KB ~ 1MB
- **大文件**（> 100MB）：1MB ~ 10MB

### 2. 网络优化

- 使用校验和验证数据完整性
- 实现失败重试机制
- 支持断点续传

### 3. 内存管理

- 流式处理避免一次性加载全部数据
- 及时释放已处理的分段数据
- 监控内存使用情况

## 示例代码

### Python 完整示例

```python
import asyncio
import base64
import hashlib
import math

import httpx


async def chunked_upload_example():
    file_content = b"大文件内容..." * 10000
    chunk_size = 1024 * 1024  # 1MB
    
    async with httpx.AsyncClient(base_url="http://localhost:8001") as client:
        # 初始化
        init = await client.post("/chunked/upload/init", json={
            "file_name": "example.txt",
            "file_size": len(file_content),
            "chunk_size": chunk_size,
        })
        session_id = init.json()["session_id"]
        
        # 分段上传
        total_chunks = math.ceil(len(file_content) / chunk_size)
        for i in range(total_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(file_content))
            chunk = file_content[start:end]
            
            await client.post("/chunked/upload/chunk", json={
                "session_id": session_id,
                "chunk_index": i,
                "chunk_data": base64.b64encode(chunk).decode(),
                "checksum": hashlib.md5(chunk).hexdigest(),
            })
        
        # 开始解析
        await client.post("/chunked/parse/start", json={
            "session_id": session_id,
        })
        
        # 等待完成
        while True:
            progress = await client.get(
                f"/chunked/parse/{session_id}/progress"
            )
            if progress.json()["status"] in ["completed", "failed"]:
                break
            await asyncio.sleep(0.5)
        
        # 获取结果
        result = await client.get(f"/chunked/parse/{session_id}/result")
        return result.json()


if __name__ == "__main__":
    asyncio.run(chunked_upload_example())
```

## 监控和调试

### 查看会话列表

```bash
curl http://localhost:8001/chunked/sessions
```

### 查看会话进度

```bash
curl http://localhost:8001/chunked/parse/{session_id}/progress
```

### 删除会话

```bash
curl -X DELETE http://localhost:8001/chunked/parse/{session_id}
```
