"""语音转录"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class TranscriptionSegment:
    """转录片段"""
    start_time: float
    end_time: float
    text: str
    confidence: float | None = None


@dataclass
class TranscriptionResult:
    """转录结果"""
    segments: list[TranscriptionSegment] = field(default_factory=list)
    full_text: str = ""
    language: str = "zh"
    total_chars: int = 0
    cn_chars: int = 0
    en_words: int = 0
    speech_rate: float = 0.0  # 字/分钟
    filler_words: dict[str, int] = field(default_factory=dict)
    reliable: bool = True
    quality_score: float = 1.0
    quality_warning: str = ""


def transcribe_with_whisper_api(
    audio_path: str,
    api_key: str,
    base_url: str,
    model: str = "whisper-1",
    language: str = "zh",
) -> TranscriptionResult | None:
    """使用 OpenAI Whisper API 进行语音转录"""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=base_url)

        with open(audio_path, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model=model,
                file=audio_file,
                language=language,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

        result = TranscriptionResult(language=language)

        for segment in response.segments:
            segment_text = segment.get("text") if isinstance(segment, dict) else getattr(segment, "text", "")
            result.segments.append(TranscriptionSegment(
                start_time=segment["start"] if isinstance(segment, dict) else segment.start,
                end_time=segment["end"] if isinstance(segment, dict) else segment.end,
                text=str(segment_text or "").strip(),
                confidence=segment.get("avg_logprob") if isinstance(segment, dict)
                else getattr(segment, "avg_logprob", None),
            ))

        result.full_text = " ".join(seg.text for seg in result.segments if seg.text)
        _calculate_statistics(result)

        return result

    except Exception as e:
        logger.warning("Whisper API transcription failed: %s", e)
        return None


def transcribe_with_local_whisper(
    audio_path: str,
    model_name: str = "tiny",
    language: str = "zh",
) -> TranscriptionResult | None:
    """使用本地 Whisper 模型进行语音转录"""
    try:
        import warnings
        warnings.filterwarnings("ignore", message="FP16 is not supported")

        import whisper

        logger.info("Loading local Whisper model (%s)...", model_name)
        model = whisper.load_model(model_name)
        result = model.transcribe(audio_path, language=language)

        transcription = TranscriptionResult(language=language)

        for segment in result.get("segments", []):
            transcription.segments.append(TranscriptionSegment(
                start_time=segment["start"],
                end_time=segment["end"],
                text=str(segment.get("text") or "").strip(),
                confidence=segment.get("avg_logprob"),
            ))

        transcription.full_text = str(result.get("text") or "")
        _calculate_statistics(transcription)

        return transcription

    except Exception as e:
        logger.warning("Local Whisper transcription failed: %s", e)
        return None


def transcribe_with_faster_whisper(
    audio_path: str,
    model_name: str = "tiny",
    language: str = "zh",
) -> TranscriptionResult | None:
    """使用 faster-whisper 进行语音转录（不需要 PyTorch）"""
    try:
        from faster_whisper import WhisperModel

        logger.info("Loading faster-whisper model (%s)...", model_name)
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        segments_raw, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
            vad_filter=True,
        )

        transcription = TranscriptionResult(language=language)

        for segment in segments_raw:
            transcription.segments.append(TranscriptionSegment(
                start_time=segment.start,
                end_time=segment.end,
                text=str(segment.text or "").strip(),
                confidence=segment.avg_logprob,
            ))

        transcription.full_text = " ".join(seg.text for seg in transcription.segments)
        _calculate_statistics(transcription)

        logger.info("faster-whisper transcription done: %d segments, %d chars",
                     len(transcription.segments), transcription.total_chars)
        return transcription

    except Exception as e:
        logger.warning("faster-whisper transcription failed: %s", e)
        return None


def _calculate_statistics(result: TranscriptionResult) -> None:
    """计算转录统计信息"""
    import re

    text = str(result.full_text or "")
    result.full_text = text

    # 字数统计
    result.cn_chars = len(re.findall(r'[一-鿿]', text))
    result.en_words = len(re.findall(r'[a-zA-Z]+', text))
    result.total_chars = result.cn_chars + result.en_words

    # 语速计算
    if result.segments:
        total_duration = result.segments[-1].end_time - result.segments[0].start_time
        if total_duration > 0:
            result.speech_rate = result.total_chars / total_duration * 60

    # 口头禅检测
    filler_words = ["然后", "就是", "这个", "那个", "嗯", "啊", "呃", "对吧", "是吧", "其实", "反正"]
    for fw in filler_words:
        count = text.count(fw)
        if count >= 2:
            result.filler_words[fw] = count

    _assess_transcription_quality(result)


def _assess_transcription_quality(result: TranscriptionResult) -> None:
    """Mark distorted or hallucinated transcripts as unsafe scoring evidence."""
    if result.total_chars < 10 or not result.segments:
        result.reliable = False
        result.quality_score = 0.0
        result.quality_warning = "有效转录内容过少，ASR 结果不参与评分。"
        return

    confidence_values = [
        segment.confidence
        for segment in result.segments
        if segment.confidence is not None
    ]
    confidence_score = 1.0
    if confidence_values:
        average_log_probability = sum(confidence_values) / len(confidence_values)
        confidence_score = max(0.0, min(1.0, (average_log_probability + 1.5) / 1.2))

    normalized_segments = [
        "".join(segment.text.lower().split())
        for segment in result.segments
        if segment.text.strip()
    ]
    duplicate_ratio = (
        1 - len(set(normalized_segments)) / len(normalized_segments)
        if normalized_segments
        else 1.0
    )
    repetition_score = max(0.0, 1.0 - duplicate_ratio * 1.5)
    result.quality_score = round(confidence_score * 0.7 + repetition_score * 0.3, 2)

    if result.quality_score < 0.45 or duplicate_ratio >= 0.6:
        result.reliable = False
        result.quality_warning = "ASR 转录可信度过低或存在大量重复，不参与内容判断和评分。"


def build_speech_analysis(transcription: TranscriptionResult, audio_features, metadata) -> str:
    """构建语音节奏分析文本"""
    if not transcription or not transcription.full_text:
        return "（语音转录不可用）"
    if not transcription.reliable:
        return f"（{transcription.quality_warning}）"

    import re

    # 语速评估
    rate = transcription.speech_rate
    if rate < 150:
        rate_eval = "偏慢，可能显得拖沓"
    elif rate < 200:
        rate_eval = "适中"
    elif rate < 260:
        rate_eval = "偏快，可能影响理解"
    else:
        rate_eval = "过快，听众难以跟上"

    # 停顿分析
    short_pauses = audio_features.short_pauses if audio_features else 0
    long_pauses = audio_features.long_pauses if audio_features else 0

    # 口头禅信息
    filler_info = ""
    if transcription.filler_words:
        sorted_fillers = sorted(transcription.filler_words.items(), key=lambda x: -x[1])
        filler_info = "\n- 口头禅: " + ", ".join(f"'{fw}'({cnt}次)" for fw, cnt in sorted_fillers[:5])

    # 语音比例
    speech_ratio = audio_features.speech_ratio if audio_features else 0

    return f"""语音节奏分析：
- 语速: {rate:.0f} 字/分钟 ({rate_eval})
- 语音比例: {speech_ratio:.1%}
- 短停顿(0.5-2s): {short_pauses} 次
- 长停顿(>2s): {long_pauses} 次
- 总字数: {transcription.total_chars} (中文{transcription.cn_chars} + 英文{transcription.en_words}词){filler_info}"""
