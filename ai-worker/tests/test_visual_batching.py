import sys
from types import ModuleType, SimpleNamespace

from app import analysis_jobs
from app.analysis_jobs import _assess, _summarize_visual_batches
from app.content_analysis import ContentExtractionResult, EvidenceUnit


def test_visual_evidence_is_sent_in_bounded_batches(monkeypatch) -> None:
    result = ContentExtractionResult(evidence=[
        EvidenceUnit(
            id=f"image-{index}",
            file_name=f"image-{index}.jpg",
            modality="image",
            locator=f"image-{index}",
            metadata={"artifactObjectKey": f"artifact-{index}"},
        )
        for index in range(9)
    ])
    calls: list[list[dict[str, object]]] = []

    monkeypatch.setattr("app.analysis_jobs._artifact_data_url", lambda key: f"data:image/jpeg;base64,{key}")

    def fake_response(_client, _model_name, content):
        calls.append(content)
        return "compact visual summary"

    monkeypatch.setattr("app.analysis_jobs._stream_response_text", fake_response)

    summaries = _summarize_visual_batches(object(), "vision-model", result)

    assert len(calls) == 3
    assert [sum(item["type"] == "input_image" for item in call) for call in calls] == [4, 4, 1]
    assert len(summaries) == 3


def test_final_assessment_uses_one_structured_request_with_bounded_images(monkeypatch) -> None:
    result = ContentExtractionResult(evidence=[
        EvidenceUnit(
            id=f"image-{index}",
            file_name=f"image-{index}.jpg",
            modality="image",
            locator=f"image-{index}",
            metadata={"artifactObjectKey": f"artifact-{index}"},
        )
        for index in range(6)
    ] + [
        EvidenceUnit(
            id="document:section:1",
            file_name="brief.md",
            modality="text-section",
            locator="brief.md#paragraph=1",
            text="The structured assignment context.",
            metadata={"heading": "Brief"},
        )
    ])
    captured: list[list[dict[str, object]]] = []

    monkeypatch.setattr(
        analysis_jobs,
        "get_settings",
        lambda: SimpleNamespace(
            model_api_base_url="https://example.invalid",
            model_api_key="key",
            text_model_name="text-model",
            multimodal_model_name=None,
            vision_model_name=None,
        ),
    )
    monkeypatch.setattr("app.analysis_jobs._artifact_data_url", lambda key: f"data:image/jpeg;base64,{key}")
    monkeypatch.setattr(
        "app.analysis_jobs._stream_response_text",
        lambda _client, _model, content: captured.append(content) or "{}",
    )

    module = ModuleType("openai")
    module.OpenAI = lambda **_kwargs: object()
    monkeypatch.setitem(sys.modules, "openai", module)

    _assess(result, "")

    assert len(captured) == 1
    assert sum(item["type"] == "input_image" for item in captured[0]) == 4
    assert '"formatVersion": "submission-context-v2"' in captured[0][0]["text"]
