from app.analysis_jobs import _structured_text_context
from app.content_analysis import EvidenceUnit


def test_structured_text_context_keeps_locator_heading_and_bounds() -> None:
    evidence = [
        EvidenceUnit(
            id="report:section:1",
            file_name="report.md",
            modality="text-section",
            locator="report.md#paragraph=1-2",
            text="第一部分内容",
            metadata={"heading": "作品说明"},
        ),
        EvidenceUnit(
            id="report:document",
            file_name="report.md",
            modality="text-document",
            locator="report.md",
            text="不应重复发送的全文",
        ),
    ]

    context = _structured_text_context(evidence)

    assert "[report:section:1]" in context
    assert "report.md#paragraph=1-2" in context
    assert "作品说明" in context
    assert "不应重复发送的全文" not in context
