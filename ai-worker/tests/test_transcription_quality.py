from app.modules.work_analysis.transcriber import (
    TranscriptionResult,
    _calculate_statistics,
    TranscriptionResult,
    TranscriptionSegment,
    _calculate_statistics,
)


def test_null_transcript_is_treated_as_empty_unreliable_evidence() -> None:
    result = TranscriptionResult(full_text=None)  # type: ignore[arg-type]

    _calculate_statistics(result)

    assert result.full_text == ""
    assert result.total_chars == 0
    assert result.reliable is False


def _result(texts: list[str], confidence: float) -> TranscriptionResult:
    segments = [
        TranscriptionSegment(index * 2, index * 2 + 1.5, text, confidence)
        for index, text in enumerate(texts)
    ]
    return TranscriptionResult(
        segments=segments,
        full_text=" ".join(texts),
        language="zh",
    )


def test_accepts_clear_non_repetitive_transcription() -> None:
    result = _result(
        ["课程目标介绍清楚", "作品结构设计合理", "最后总结实现效果"],
        -0.25,
    )

    _calculate_statistics(result)

    assert result.reliable is True
    assert result.quality_score >= 0.45
    assert result.quality_warning == ""


def test_rejects_low_confidence_transcription() -> None:
    result = _result(
        ["课程目标介绍清楚", "作品结构设计合理", "最后总结实现效果"],
        -1.45,
    )

    _calculate_statistics(result)

    assert result.reliable is False
    assert result.quality_warning


def test_rejects_repeated_hallucinated_segments() -> None:
    result = _result(["谢谢观看"] * 5, -0.2)

    _calculate_statistics(result)

    assert result.reliable is False
    assert result.quality_warning
