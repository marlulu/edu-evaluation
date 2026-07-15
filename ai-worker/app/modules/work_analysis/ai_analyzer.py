"""AI 分析：画面描述、综合分析、评判标准评分"""

from __future__ import annotations

import logging
import mimetypes
import re
import time
from dataclasses import dataclass, field
from typing import Callable

from .frame_extractor import Keyframe, encode_image_base64
from .transcriber import TranscriptionResult, build_speech_analysis

logger = logging.getLogger(__name__)

MAX_VISION_FRAMES = 12
VISION_BATCH_SIZE = 4
MAX_ANALYSIS_CHARACTERS = 7000
MAX_CRITERIA_CHARACTERS = 8000
MAX_SUPPORTING_DOCUMENT_CHARACTERS = 6000
MAX_OUTPUT_TOKENS = 1800
DURATION_FEEDBACK_PATTERN = re.compile(r"时长|片长|播放时间|过长|过短|\d+(?:\.\d+)?\s*(?:分钟|分|秒)")


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


def _call_ai(client, model: str, prompt: str, max_retries: int = 2) -> str:
    """通用 AI 调用（带重试）"""
    for attempt in range(max_retries):
        try:
            resp = client.responses.create(
                model=model,
                input=[{"role": "user", "content": prompt}],
                store=False,
                max_output_tokens=MAX_OUTPUT_TOKENS,
            )
            return resp.output_text
        except Exception as e:
            if attempt < max_retries - 1:
                wait = attempt + 1
                logger.warning("AI call failed, retrying in %ds... (%s)", wait, e)
                time.sleep(wait)
            else:
                return f"[AI 调用失败] {e}"


def _call_ai_multimodal(client, model: str, content: list, max_retries: int = 2) -> str:
    """多模态 AI 调用（带重试）"""
    for attempt in range(max_retries):
        try:
            resp = client.responses.create(
                model=model,
                input=[{"role": "user", "content": content}],
                store=False,
                max_output_tokens=1200,
            )
            return resp.output_text.strip()
        except Exception as e:
            if attempt < max_retries - 1:
                wait = attempt + 1
                logger.warning("Multimodal AI call failed, retrying in %ds... (%s)", wait, e)
                time.sleep(wait)
            else:
                return f"(画面分析失败: {e})"


def describe_keyframes_with_ai(
    client,
    model: str,
    keyframes: list[Keyframe],
    batch_progress: Callable[[int, int], None] | None = None,
) -> str:
    """一次调用分析所有关键帧，返回综合场景描述"""
    if len(keyframes) > MAX_VISION_FRAMES:
        step = (len(keyframes) - 1) / (MAX_VISION_FRAMES - 1)
        keyframes = [keyframes[round(index * step)] for index in range(MAX_VISION_FRAMES)]

    usable_frames = [
        (index, frame)
        for index, frame in enumerate(keyframes, start=1)
        if frame.path or frame.image_base64
    ]
    if not usable_frames:
        return "(无可分析的关键帧)"

    batch_results: list[str] = []
    total_batches = (len(usable_frames) + VISION_BATCH_SIZE - 1) // VISION_BATCH_SIZE
    for offset in range(0, len(usable_frames), VISION_BATCH_SIZE):
        batch = usable_frames[offset:offset + VISION_BATCH_SIZE]
        labels = [f"图{index} ({frame.timestamp}s)" for index, frame in batch]
        content = [{
            "type": "input_text",
            "text": f"""这是视觉证据第 {offset // VISION_BATCH_SIZE + 1}/{total_batches} 批，
包含：{', '.join(labels)}。

请用中文分析：
1. 按全局编号逐张描述角色、场景、动作，每图1-2句
2. 概括本批共同主题与内容变化
不要虚构未展示的其他图片。""",
        }]
        for _, frame in batch:
            if frame.path:
                mime_type = mimetypes.guess_type(frame.path)[0] or "image/jpeg"
                content.append({
                    "type": "input_image",
                    "image_url": f"data:{mime_type};base64,{encode_image_base64(frame.path)}",
                })
            else:
                content.append({
                    "type": "input_image",
                    "image_url": frame.image_base64,
                })
        batch_results.append(
            f"【视觉证据第 {offset // VISION_BATCH_SIZE + 1} 批】\n"
            + _call_ai_multimodal(client, model, content)
        )
        if batch_progress:
            batch_progress(offset // VISION_BATCH_SIZE + 1, total_batches)

    return "\n\n".join(batch_results)


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
    usable_ocr = [
        kf for kf in keyframes
        if kf.ocr_texts and kf.ocr_summary and not kf.ocr_summary.startswith("(")
    ]
    if usable_ocr:
        for kf in usable_ocr:
            keyframe_info += f"- {kf.timestamp}s: [OCR] {kf.ocr_summary}\n"
    else:
        keyframe_info += "- 无可靠 OCR 文字，忽略该证据\n"

    # 转录内容
    transcription_info = ""
    if transcription and transcription.full_text and transcription.reliable:
        transcription_info = f"语音转录内容:\n{transcription.full_text[:1200]}"
    elif transcription and not transcription.reliable:
        transcription_info = f"（{transcription.quality_warning}）"
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
    if transcription and transcription.reliable:
        all_text = transcription.full_text + " " + " ".join(
            kf.ocr_summary for kf in usable_ocr
        )
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
    supporting_document_text: str | None = None,
    supporting_document_name: str | None = None,
) -> dict | str:
    """根据评判标准对视频分析结果进行评分，返回结构化字典或原始文本"""
    document_section = ""
    conformity_schema = '"document_conformity": null'
    analysis_result = analysis_result[:MAX_ANALYSIS_CHARACTERS]
    criteria_text = criteria_text[:MAX_CRITERIA_CHARACTERS]
    if supporting_document_text:
        document_section = f"""

【说明文档：{supporting_document_name or "未命名文档"}】
{supporting_document_text[:MAX_SUPPORTING_DOCUMENT_CHARACTERS]}

请提取最多 10 条与主题、设计选择、技术实现或预期效果有关的可验证陈述，
并用作品证据判断为 supported、partially_supported、unsupported 或
unverifiable。无法验证或与评分标准无关的陈述不得导致扣分。
"""
        conformity_schema = """"document_conformity": {
    "summary": "作品与说明文档的总体符合情况",
    "findings": [
      {
        "claim": "文档中的可验证陈述",
        "status": "supported",
        "work_evidence": "作品中的对应证据",
        "related_dimension": "关联评分维度"
      }
    ]
  }"""

    prompt = f"""你是一位专业的视频评审专家。请根据以下【评判标准】对【视频分析结果】进行逐条评分。

【评判标准】
{criteria_text}

【视频分析结果】
{analysis_result}
{document_section}

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
  ],
  "brief_comment": "不超过120个中文字符的简短评语",
  "notes": ["最多三条关键限制或异常"],
  {conformity_schema}
}}
```

要求：
1. scores 数组必须包含评判标准中的每一个评分项，保持原始维度名称和满分
2. total_score 为所有 scores 中 score 之和
3. grade 根据 total_score 判定：优秀(90+)/良好(80+)/合格(60+)/不合格(<60)
4. strengths 列出 2-3 个主要优点
5. weaknesses 列出 2-3 个主要不足
6. priority_suggestions 列出最重要的 3 个改进点
7. brief_comment 使用 1-2 句话，且不超过 120 个中文字符
8. notes 最多 3 条；没有关键限制或异常时返回空数组
9. 说明文档只能作为评分证据，不能取代作品中可观察到的证据
10. strengths、weaknesses、priority_suggestions 和 brief_comment 只评价作品内容，
包括主题表达、结构逻辑、创意、叙事、视觉或听觉表达及其改进；禁止评价作品时长、
片长、分钟数或秒数。时长如属于评判标准，只能出现在对应 scores 项中"""

    raw = _call_ai(client, model, prompt)
    return _parse_evaluation_json(raw, criteria_text)


def _parse_evaluation_json(raw: str, criteria_text: str) -> dict | str:
    """解析 LLM 返回的评分 JSON，容错处理"""
    from .schemas import DocumentConformity, EvaluationResult, ScoreItem

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
            strengths=_content_feedback_items(data.get("strengths", [])),
            weaknesses=_content_feedback_items(data.get("weaknesses", [])),
            priority_suggestions=_content_feedback_items(data.get("priority_suggestions", [])),
            criteria_text=criteria_text,
            brief_comment=_content_feedback_comment(data.get("brief_comment", ""))[:120],
            notes=[str(note) for note in data.get("notes", [])[:3]],
            document_conformity=(
                DocumentConformity.model_validate(data["document_conformity"])
                if isinstance(data.get("document_conformity"), dict)
                else None
            ),
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
            "brief_comment": "",
            "notes": [],
            "document_conformity": None,
            "raw_text": raw,
        }


def _content_feedback_items(values: list | None) -> list[str]:
    return [
        text
        for value in (values or [])
        if (text := str(value).strip()) and not DURATION_FEEDBACK_PATTERN.search(text)
    ]


def _content_feedback_comment(value: object) -> str:
    sentences = re.split(r"(?<=[。！？；])", str(value or ""))
    return "".join(
        sentence for sentence in sentences
        if sentence.strip() and not DURATION_FEEDBACK_PATTERN.search(sentence)
    ).strip()
