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
            result.segments.append(TranscriptionSegment(
                start_time=segment["start"],
                end_time=segment["end"],
                text=segment["text"],
                confidence=segment.get("avg_logprob"),
            ))

        result.full_text = " ".join(seg.text for seg in result.segments)
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
                text=segment["text"],
                confidence=segment.get("avg_logprob"),
            ))

        transcription.full_text = result.get("text", "")
        _calculate_statistics(transcription)

        return transcription

    except Exception as e:
        logger.warning("Local Whisper transcription failed: %s", e)
        return None


def _calculate_statistics(result: TranscriptionResult) -> None:
    """计算转录统计信息"""
    import re

    text = result.full_text

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


def build_speech_analysis(transcription: TranscriptionResult, audio_features, metadata) -> str:
    """构建语音节奏分析文本"""
    if not transcription or not transcription.full_text:
        return "（语音转录不可用）"

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
