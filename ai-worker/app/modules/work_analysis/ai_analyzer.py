"""AI 分析：画面描述、综合分析、评判标准评分"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field

from .frame_extractor import Keyframe, encode_image_base64
from .transcriber import TranscriptionResult, build_speech_analysis

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """分析结果"""
    overall_topic: str = "未知"
    summary: str = ""
    key_points: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    scene_description: str = ""
    ai_analysis: str = ""
    evaluation: str = ""
    issues: list[dict] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


def _call_ai(client, model: str, prompt: str, max_retries: int = 3) -> str:
    """通用 AI 调用（带重试）"""
    for attempt in range(max_retries):
        try:
            resp = client.responses.create(
                model=model,
                input=[{"role": "user", "content": prompt}],
                store=False,
            )
            # 检查响应是否完整
            print(f"[DEBUG] AI response status: {resp.status}")
            if hasattr(resp, 'incomplete_details') and resp.incomplete_details:
                print(f"[DEBUG] AI response incomplete: {resp.incomplete_details}")
            print(f"[DEBUG] AI response output_text length: {len(resp.output_text) if resp.output_text else 0}")
            return resp.output_text
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 5
                logger.warning("AI call failed, retrying in %ds... (%s)", wait, e)
                time.sleep(wait)
            else:
                return f"[AI 调用失败] {e}"


def _call_ai_multimodal(client, model: str, content: list, max_retries: int = 3) -> str:
    """多模态 AI 调用（带重试）"""
    for attempt in range(max_retries):
        try:
            resp = client.responses.create(
                model=model,
                input=[{"role": "user", "content": content}],
                store=False,
            )
            return resp.output_text.strip()
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 5
                logger.warning("Multimodal AI call failed, retrying in %ds... (%s)", wait, e)
                time.sleep(wait)
            else:
                return f"(画面分析失败: {e})"


def describe_keyframes_with_ai(
    client,
    model: str,
    keyframes: list[Keyframe],
) -> str:
    """一次调用分析所有关键帧，返回综合场景描述"""
    frame_labels = []
    content = [
        {
            "type": "input_text",
            "text": f"""以下是视频的 {len(keyframes)} 张关键帧截图，按时间顺序排列。

请用中文分析：
1. 每张图的画面内容（角色、场景、动作），用 "图N: ..." 格式，每图1-2句
2. 整体视频主题推测
3. 内容变化趋势（画面如何推进）""",
        }
    ]

    for i, kf in enumerate(keyframes):
        if kf.path:
            frame_labels.append(f"图{i + 1} ({kf.timestamp}s)")
            content.append({
                "type": "input_image",
                "image_url": f"data:image/jpeg;base64,{encode_image_base64(kf.path)}",
            })
        elif kf.image_base64:
            frame_labels.append(f"图{i + 1} ({kf.timestamp}s)")
            content.append({
                "type": "input_image",
                "image_url": kf.image_base64,
            })

    if not frame_labels:
        return "(无可分析的关键帧)"

    content[0]["text"] = f"""以下是视频的 {len(frame_labels)} 张关键帧截图，按时间顺序排列：{', '.join(frame_labels)}。

请用中文分析：
1. 每张图的画面内容（角色、场景、动作），用 "图N: ..." 格式，每图1-2句
2. 整体视频主题推测
3. 内容变化趋势（画面如何推进）"""

    return _call_ai_multimodal(client, model, content)


def analyze_comprehensive(
    client,
    model: str,
    metadata,
    audio_features,
    transcription: TranscriptionResult | None,
    keyframes: list[Keyframe],
    scene_description: str,
) -> str:
    """调用 AI 模型进行综合分析"""
    # 语音节奏分析
    speech_analysis = build_speech_analysis(transcription, audio_features, metadata)

    # 关键帧 OCR 信息
    keyframe_info = "关键帧内容：\n"
    for kf in keyframes:
        keyframe_info += f"- {kf.timestamp}s: [OCR] {kf.ocr_summary or 'N/A'}\n"

    # 转录内容
    transcription_info = ""
    if transcription and transcription.full_text:
        transcription_info = f"语音转录内容:\n{transcription.full_text[:600]}"
    else:
        transcription_info = "（语音转录不可用）"

    # 分辨率评估
    w, h = metadata.width, metadata.height
    if w >= 1920 or h >= 1080:
        res_level = "1080p+ 高清"
    elif w >= 1280 or h >= 720:
        res_level = "720p 标清"
    elif w > 0:
        res_level = "低分辨率"
    else:
        res_level = "未知"

    # 音频信息
    mean_vol = audio_features.mean_volume if audio_features else -20
    max_vol = audio_features.max_volume if audio_features else -10
    vol_warning = ""
    if mean_vol < -30:
        vol_warning = "\n- [警告] 平均音量过低，可能听不清"
    elif mean_vol > -5:
        vol_warning = "\n- [警告] 平均音量过高，可能失真"

    # 长静音段
    long_silences = []
    if audio_features:
        long_silences = [s for s in audio_features.silence_segments if s.duration > 3]

    silence_issues = ""
    if long_silences:
        silence_issues = "\n- 长静音段(>3s): " + ", ".join(
            f"{s.start:.1f}-{s.end:.1f}s({s.duration:.1f}s)" for s in long_silences
        )

    # 专业术语提取
    terms_info = ""
    if transcription:
        all_text = transcription.full_text + " " + " ".join(kf.ocr_summary for kf in keyframes)
        cn_terms = set(re.findall(r'[一-鿿]{4,8}', all_text))
        en_terms = set(t.lower() for t in re.findall(r'[A-Za-z]{3,}', all_text) if len(t) >= 4)
        common_words = {"这个", "那个", "就是", "然后", "可以", "应该", "因为", "所以", "如果", "但是"}
        cn_terms -= common_words

        if cn_terms or en_terms:
            terms_list = list(cn_terms)[:10] + list(en_terms)[:5]
            terms_info = f"\n- 识别到的专业词汇: {', '.join(terms_list)}"

    prompt = f"""请分析以下视频，用中文回答：

【视频元数据】
- 时长: {metadata.duration:.1f}秒
- 分辨率: {w}x{h} ({res_level})
- 帧率: {metadata.fps}fps

【音频分析】
- 音量范围: {mean_vol} dB (均值) ~ {max_vol} dB (最大){vol_warning}
- 静音段数量: {len(audio_features.silence_segments) if audio_features else 0}{silence_issues}
{speech_analysis}
{terms_info}

【关键帧 OCR】
{keyframe_info}

【画面场景描述】
{scene_description}

【语音转录】
{transcription_info}

请回答：

一、内容总结
1. 视频主题（根据画面+语音综合判断）
2. 内容摘要（150字内）
3. 核心要点（3个）

二、缺陷分析
请从以下维度逐一检查，指出具体问题：
1. 【画面质量】分辨率、清晰度、色彩是否达标
2. 【音频质量】音量是否均衡、有无杂音/爆音、语音是否清晰
3. 【内容节奏】有无过长静音/空白段、节奏是否拖沓或过快
4. 【信息密度】关键信息是否突出、有无冗余画面
5. 【结构完整性】开头是否吸引人、结尾是否有总结、逻辑是否连贯

三、谈吐与节奏分析
根据语音节奏数据，重点分析：
1. 【语速控制】语速是否合适？过快/过慢如何调整？
2. 【停顿运用】停顿是否合理？哪里该停没停？哪里停顿过长？
3. 【口头禅问题】列出出现的口头禅，评估影响程度
4. 【表达流畅度】是否有卡顿、重复、修正？

四、综合改进建议
针对以上所有问题，按优先级给出具体可执行的改进方案。"""

    return _call_ai(client, model, prompt)


def evaluate_with_criteria(
    client,
    model: str,
    analysis_result: str,
    criteria_text: str,
) -> dict | str:
    """根据评判标准对视频分析结果进行评分，返回结构化字典或原始文本"""
    prompt = f"""你是一位专业的视频评审专家。请根据以下【评判标准】对【视频分析结果】进行逐条评分。

【评判标准】
{criteria_text}

【视频分析结果】
{analysis_result}

请严格按照以下 JSON 格式返回评分结果，不要输出任何其他内容：

```json
{{
  "total_score": 85.0,
  "grade": "良好",
  "scores": [
    {{
      "dimension": "评分维度名称",
      "max_score": 15.0,
      "score": 12.0,
      "evidence": "得分依据（引用分析结果中的具体内容）",
      "suggestion": "改进建议（具体可执行的操作）"
    }}
  ],
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["不足1", "不足2"],
  "priority_suggestions": [
    "最紧迫：...",
    "次重要：...",
    "锦上添花：..."
  ]
}}
```

要求：
1. scores 数组必须包含评判标准中的每一个评分项，保持原始维度名称和满分
2. total_score 为所有 scores 中 score 之和
3. grade 根据 total_score 判定：优秀(90+)/良好(80+)/合格(60+)/不合格(<60)
4. strengths 列出 2-3 个主要优点
5. weaknesses 列出 2-3 个主要不足
6. priority_suggestions 列出最重要的 3 个改进点"""

    raw = _call_ai(client, model, prompt)
    return _parse_evaluation_json(raw, criteria_text)


def _parse_evaluation_json(raw: str, criteria_text: str) -> dict | str:
    """解析 LLM 返回的评分 JSON，容错处理"""
    from .schemas import EvaluationResult, ScoreItem

    # 尝试从 markdown 代码块中提取 JSON
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw, re.DOTALL)
    text = json_match.group(1).strip() if json_match else raw.strip()

    # 尝试直接解析
    try:
        import json
        data = json.loads(text)
        # 验证并规范化
        result = EvaluationResult(
            total_score=float(data.get("total_score", 0)),
            grade=str(data.get("grade", "")),
            scores=[
                ScoreItem(
                    dimension=str(s.get("dimension", "")),
                    max_score=float(s.get("max_score", 0)),
                    score=float(s.get("score", 0)),
                    evidence=str(s.get("evidence", "")),
                    suggestion=str(s.get("suggestion", "")),
                )
                for s in data.get("scores", [])
            ],
            strengths=[str(s) for s in data.get("strengths", [])],
            weaknesses=[str(w) for w in data.get("weaknesses", [])],
            priority_suggestions=[str(p) for p in data.get("priority_suggestions", [])],
            criteria_text=criteria_text,
        )
        return result.model_dump()
    except Exception as e:
        logger.warning("Failed to parse evaluation JSON: %s", e)
        # 回退：返回原始文本包装为简单结构
        return {
            "total_score": 0,
            "grade": "",
            "scores": [],
            "strengths": [],
            "weaknesses": [],
            "priority_suggestions": [],
            "criteria_text": criteria_text,
            "raw_text": raw,
        }
