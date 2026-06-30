# 模型配置验证指南

本文档介绍如何验证管理员配置的 AI 模型是否真实有效。

## 概述

系统提供三层验证机制确保模型配置有效：

1. **配置完整性检查** - 验证必填字段是否完整
2. **网络连接测试** - 验证 API 地址是否可达
3. **模型调用测试** - 验证模型是否能正常响应

## 验证流程

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  配置完整性检查  │ ──▶ │  网络连接测试   │ ──▶ │  模型调用测试   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   检查必填字段           测试 API 地址           发送测试请求
   - 模型名称             是否可达               验证响应
   - API 地址
   - API Key
```

## 前端操作

### 1. 进入系统管理

登录管理员账号，进入「系统配置」→「模型配置」。

### 2. 执行测试

在模型列表中，点击「测试可用性」按钮：

![测试按钮位置]

### 3. 查看测试结果

测试完成后会显示详细结果：

#### 测试通过示例

```
✅ 模型测试通过

模型名称：GPT-4
模型连接成功，可以正常调用。
总耗时：1250ms

测试详情：
├─ 配置检查 - 配置完整
├─ 网络连接 - 连接成功 (HTTP 200)
└─ 模型调用 - 调用成功，响应时间 1200ms

AI 响应内容：
测试成功

测试时间：2026-06-23 10:30:00
```

#### 测试失败示例

```
❌ 模型测试未通过

模型名称：GPT-4
模型连接失败，请检查配置。
总耗时：500ms

测试详情：
├─ 配置检查 - 配置完整
├─ 网络连接 - 连接成功 (HTTP 200)
└─ 模型调用 - 调用失败: 认证失败，请检查 API Key

测试时间：2026-06-23 10:30:00
```

## 后端验证逻辑

### 配置完整性检查

检查以下必填字段：

| 字段 | 说明 |
|------|------|
| `model_name` | 模型名称 |
| `base_url` | API 地址 |
| `api_key_configured` | API Key 是否已配置 |

### 网络连接测试

- 测试 API 地址是否可达
- 记录响应状态码和响应时间
- 支持超时检测（默认 10 秒）

### 模型调用测试

发送测试请求到 AI Worker：

```
POST http://localhost:8001/models/test

{
  "model_name": "gpt-4",
  "base_url": "https://api.example.com/v1",
  "api_key_configured": true,
  "test_prompt": "请回复'测试成功'四个字。",
  "max_tokens": 50
}
```

AI Worker 会：

1. 验证配置完整性
2. 测试网络连接
3. 调用模型 API
4. 返回详细结果

## API 接口

### 后端 API

```
POST /api/system-admin/models/{id}/test
```

响应：
```json
{
  "modelId": "xxx",
  "modelName": "GPT-4",
  "success": true,
  "message": "模型测试通过",
  "responseTimeMs": 1250,
  "checks": [
    "配置检查 - 配置完整",
    "网络连接 - 连接成功 (HTTP 200)",
    "模型调用 - 调用成功"
  ],
  "aiResponse": "测试成功",
  "testedAt": "2026-06-23T10:30:00Z"
}
```

### AI Worker API

```
POST /models/test
```

请求：
```json
{
  "model_name": "gpt-4",
  "base_url": "https://api.example.com/v1",
  "api_key_configured": true,
  "test_prompt": "请回复'测试成功'四个字。",
  "max_tokens": 50,
  "timeout_seconds": 30
}
```

响应：
```json
{
  "success": true,
  "model_name": "gpt-4",
  "message": "模型测试通过",
  "response_time_ms": 1200,
  "checks": [
    {
      "name": "配置检查",
      "passed": true,
      "message": "配置完整"
    },
    {
      "name": "网络连接",
      "passed": true,
      "message": "连接成功 (HTTP 200)",
      "duration_ms": 50
    },
    {
      "name": "模型调用",
      "passed": true,
      "message": "调用成功，响应时间 1150ms",
      "duration_ms": 1150
    }
  ],
  "ai_response": "测试成功",
  "tested_at": "2026-06-23T10:30:00Z"
}
```

## 常见错误及解决

### 1. 认证失败 (401)

**错误信息**：`认证失败，请检查 API Key`

**解决方案**：
- 检查 API Key 是否正确
- 确认 API Key 是否有效（未过期、未被撤销）
- 检查 API Key 权限是否足够

### 2. 模型不存在 (404)

**错误信息**：`模型不存在，请检查模型名称`

**解决方案**：
- 检查模型名称是否正确
- 确认该模型是否在当前 API 提供商中可用
- 参考 API 提供商的模型列表

### 3. 连接超时

**错误信息**：`连接超时，请检查网络或地址`

**解决方案**：
- 检查网络连接
- 确认 API 地址是否正确
- 检查防火墙设置
- 尝试增加超时时间

### 4. 请求频率限制 (429)

**错误信息**：`请求频率过高，请稍后重试`

**解决方案**：
- 等待一段时间后重试
- 检查 API 配额是否用尽
- 考虑升级 API 套餐

## 最佳实践

### 1. 配置后立即测试

每次修改模型配置后，立即点击「测试可用性」验证配置是否正确。

### 2. 定期健康检查

建议定期（如每周）测试所有已启用的模型配置，确保持续可用。

### 3. 记录测试结果

系统会自动记录测试时间和结果到审计日志，便于追踪问题。

### 4. 测试环境隔离

建议先在测试环境验证模型配置，确认无误后再应用到生产环境。

## 快速测试

### 使用 curl 测试 AI Worker

```bash
# 测试默认配置
curl http://localhost:8001/models/test/quick

# 测试指定模型
curl -X POST http://localhost:8001/models/test \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "gpt-4",
    "base_url": "https://api.example.com/v1",
    "api_key_configured": true,
    "test_prompt": "请回复测试成功"
  }'
```

### 使用 Python 测试

```python
import httpx

response = httpx.post(
    "http://localhost:8001/models/test",
    json={
        "model_name": "gpt-4",
        "base_url": "https://api.example.com/v1",
        "api_key_configured": True,
        "test_prompt": "请回复'测试成功'四个字。",
    }
)

result = response.json()
print(f"测试结果: {'通过' if result['success'] else '失败'}")
print(f"响应时间: {result['response_time_ms']}ms")
```

## 监控建议

### 1. 健康检查端点

```
GET /health
```

返回 AI Worker 状态和模型配置信息。

### 2. 审计日志

所有模型测试操作都会记录到审计日志，包括：
- 测试时间
- 测试结果
- 错误信息

### 3. 告警机制

建议设置告警规则：
- 模型测试连续失败 N 次
- 响应时间超过阈值
- 错误率超过阈值
