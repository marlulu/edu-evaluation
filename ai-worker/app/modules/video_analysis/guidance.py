"""音频内容指导生成器"""

from __future__ import annotations

import json
from typing import Any

from app.modules.video_analysis.schemas import (
    AudioAnalysis,
    AudioGuidanceRequest,
    AudioGuidanceType,
    DimensionEvaluation,
    GuidanceContent,
)
from app.providers.openai_compatible import OpenAICompatibleProvider


class AudioGuidanceGenerator:
    """音频内容指导生成器"""

    # 预设指导类型的 prompt 模板
    GUIDANCE_PROMPTS = {
        AudioGuidanceType.GENERAL: """你是一位专业的教育评价专家。请对以下音频转录内容进行专业分析和指导。

【转录内容】
{transcription}

【音频元信息】
- 总语音时长：{speech_duration:.1f} 秒
- 平均语速：{speech_rate:.1f} 字/分钟
- 检测语言：{language}
- 清晰度评分：{clarity_score}

请从以下方面进行分析：
1. 内容完整性与逻辑性
2. 表达清晰度与流畅性
3. 专业性与准确性
4. 改进建议

请返回以下 JSON 格式：
{{
    "summary": "总体评价（100字以内）",
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": ["建议1", "建议2", "建议3"],
    "detailed_feedback": "详细反馈（300字以内）",
    "score": 85
}}""",

        AudioGuidanceType.SPEECH: """你是一位专业的演讲教练。请对以下演讲内容进行专业评价。

【演讲转录内容】
{transcription}

【音频元信息】
- 总语音时长：{speech_duration:.1f} 秒
- 平均语速：{speech_rate:.1f} 字/分钟
- 清晰度评分：{clarity_score}

请重点评价以下方面：
1. 开场白的吸引力
2. 论点的逻辑结构
3. 论据的充分性
4. 语言表达的说服力
5. 结尾的总结与号召力

请返回以下 JSON 格式：
{{
    "summary": "总体评价（100字以内）",
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": ["建议1", "建议2", "建议3"],
    "detailed_feedback": "详细反馈（300字以内）",
    "score": 85
}}""",

        AudioGuidanceType.PRESENTATION: """你是一位专业的演示/报告评审专家。请对以下演示内容进行评价。

【演示转录内容】
{transcription}

【音频元信息】
- 总语音时长：{speech_duration:.1f} 秒
- 平均语速：{speech_rate:.1f} 字/分钟
- 清晰度评分：{clarity_score}

请重点评价以下方面：
1. 内容组织与结构
2. 专业性与深度
3. 表达的清晰度
4. 时间控制
5. 听众互动

请返回以下 JSON 格式：
{{
    "summary": "总体评价（100字以内）",
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": ["建议1", "建议2", "建议3"],
    "detailed_feedback": "详细反馈（300字以内）",
    "score": 85
}}""",

        AudioGuidanceType.READING: """你是一位专业的朗读指导老师。请对以下朗读内容进行评价。

【朗读转录内容】
{transcription}

【音频元信息】
- 总语音时长：{speech_duration:.1f} 秒
- 平均语速：{speech_rate:.1f} 字/分钟
- 清晰度评分：{clarity_score}

请重点评价以下方面：
1. 发音准确性
2. 语调与节奏
3. 情感表达
4. 流畅性
5. 停顿与重音

请返回以下 JSON 格式：
{{
    "summary": "总体评价（100字以内）",
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": ["建议1", "建议2", "建议3"],
    "detailed_feedback": "详细反馈（300字以内）",
    "score": 85
}}""",
    }

    def build_custom_prompt(
        self,
        transcription: AudioAnalysis,
        custom_prompt: str,
        evaluation_dimensions: list[str] | None,
    ) -> str:
        """构建自定义评价 prompt"""
        # 转录文本
        transcription_text = self._format_transcription(transcription)

        # 基础信息
        base_info = f"""【转录内容】
{transcription_text}

【音频元信息】
- 总语音时长：{transcription.total_speech_duration:.1f} 秒
- 平均语速：{transcription.average_speech_rate:.1f} 字/分钟
- 检测语言：{transcription.detected_language}
- 清晰度评分：{transcription.clarity_score}"""

        # 自定义指导
        prompt = f"""{base_info}

【评价要求】
{custom_prompt}"""

        # 如果有自定义维度，添加维度评分要求
        if evaluation_dimensions:
            dimensions_str = "、".join(evaluation_dimensions)
            prompt += f"""

【评价维度】
请对以下维度进行单独评分：{dimensions_str}

请返回以下 JSON 格式：
{{
    "summary": "总体评价（100字以内）",
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": ["建议1", "建议2", "建议3"],
    "detailed_feedback": "详细反馈（300字以内）",
    "score": 85,
    "dimension_evaluations": [
        {{"dimension_name": "维度1", "score": 90, "feedback": "该维度的反馈"}},
        {{"dimension_name": "维度2", "score": 80, "feedback": "该维度的反馈"}}
    ]
}}"""
        else:
            prompt += """

请返回以下 JSON 格式：
{
    "summary": "总体评价（100字以内）",
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": ["建议1", "建议2", "建议3"],
    "detailed_feedback": "详细反馈（300字以内）",
    "score": 85
}"""

        return prompt

    def _format_transcription(self, audio_analysis: AudioAnalysis) -> str:
        """格式化转录文本"""
        if not audio_analysis.transcription:
            return "（无转录内容）"

        lines = []
        for seg in audio_analysis.transcription[:50]:  # 限制长度
            lines.append(f"[{seg.start_time:.1f}s-{seg.end_time:.1f}s] {seg.text}")
        return "\n".join(lines)

    def _get_prompt(
        self,
        request: AudioGuidanceRequest,
        audio_analysis: AudioAnalysis,
    ) -> str:
        """获取 prompt"""
        if request.guidance_type == AudioGuidanceType.CUSTOM:
            if not request.custom_prompt:
                raise ValueError("自定义评价类型必须提供 custom_prompt")
            return self.build_custom_prompt(
                audio_analysis,
                request.custom_prompt,
                request.evaluation_dimensions,
            )

        # 使用预设模板
        template = self.GUIDANCE_PROMPTS.get(request.guidance_type)
        if not template:
            raise ValueError(f"不支持的指导类型: {request.guidance_type}")

        transcription_text = self._format_transcription(audio_analysis)

        return template.format(
            transcription=transcription_text,
            speech_duration=audio_analysis.total_speech_duration,
            speech_rate=audio_analysis.average_speech_rate,
            language=audio_analysis.detected_language,
            clarity_score=audio_analysis.clarity_score or "N/A",
        )

    def _parse_response(self, response: str) -> GuidanceContent:
        """解析 LLM 响应"""
        try:
            # 尝试提取 JSON
            json_str = response.strip()
            if json_str.startswith("```"):
                json_str = json_str.split("\n", 1)[1].rsplit("```", 1)[0]

            result = json.loads(json_str)

            # 解析维度评价
            dimension_evaluations = None
            if "dimension_evaluations" in result:
                dimension_evaluations = [
                    DimensionEvaluation(**dim)
                    for dim in result["dimension_evaluations"]
                ]

            return GuidanceContent(
                summary=result.get("summary", ""),
                strengths=result.get("strengths", []),
                weaknesses=result.get("weaknesses", []),
                suggestions=result.get("suggestions", []),
                detailed_feedback=result.get("detailed_feedback", ""),
                score=result.get("score"),
                dimension_evaluations=dimension_evaluations,
            )
        except (json.JSONDecodeError, Exception) as e:
            # 解析失败时返回基本结构
            return GuidanceContent(
                summary=response[:200] if len(response) > 200 else response,
                strengths=[],
                weaknesses=[],
                suggestions=[],
                detailed_feedback=response,
                score=None,
            )

    async def generate_guidance(
        self,
        request: AudioGuidanceRequest,
        audio_analysis: AudioAnalysis,
        provider: OpenAICompatibleProvider,
    ) -> GuidanceContent:
        """生成指导内容"""
        # 构建 prompt
        prompt = self._get_prompt(request, audio_analysis)

        # 调用 LLM
        system_prompt = "你是一位专业的教育评价专家，请根据要求对音频内容进行专业分析和指导。请返回 JSON 格式的结果，不要返回其他内容。"

        response = provider.chat(
            message=prompt,
            system_prompt=system_prompt,
            stream=False,
        )

        # 解析响应
        return self._parse_response(response)
