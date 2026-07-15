import json

from app.modules.work_analysis import ai_analyzer
from app.modules.work_analysis.ai_analyzer import _parse_evaluation_json
from app.modules.work_analysis.schemas import WorkAnalysisRequest


def test_parses_joint_evaluation_fields() -> None:
    payload = {
        "total_score": 88,
        "grade": "良好",
        "scores": [],
        "strengths": [],
        "weaknesses": [],
        "priority_suggestions": [],
        "brief_comment": "评" * 130,
        "notes": ["一", "二", "三", "四"],
        "document_conformity": {
            "summary": "基本符合",
            "findings": [
                {
                    "claim": "使用冷色调",
                    "status": "supported",
                    "work_evidence": "画面以蓝色为主",
                    "related_dimension": "视觉表达",
                }
            ],
        },
    }

    result = _parse_evaluation_json(json.dumps(payload, ensure_ascii=False), "标准")

    assert isinstance(result, dict)
    assert len(result["brief_comment"]) == 120
    assert result["notes"] == ["一", "二", "三"]
    assert result["document_conformity"]["findings"][0]["status"] == "supported"


def test_export_feedback_excludes_duration_but_keeps_content_feedback() -> None:
    payload = {
        "total_score": 80,
        "grade": "良好",
        "scores": [],
        "strengths": ["主题表达清晰", "视频时长控制合理"],
        "weaknesses": ["叙事衔接略显生硬", "片长偏长"],
        "priority_suggestions": ["补充作品细节", "压缩到3分钟以内"],
        "brief_comment": "主题鲜明，结构完整。视频时长略长。",
    }

    result = _parse_evaluation_json(json.dumps(payload, ensure_ascii=False), "标准")

    assert result["strengths"] == ["主题表达清晰"]
    assert result["weaknesses"] == ["叙事衔接略显生硬"]
    assert result["priority_suggestions"] == ["补充作品细节"]
    assert result["brief_comment"] == "主题鲜明，结构完整。"


def test_work_only_result_has_no_conformity() -> None:
    payload = {
        "total_score": 80,
        "grade": "良好",
        "scores": [],
        "strengths": [],
        "weaknesses": [],
        "priority_suggestions": [],
        "brief_comment": "整体表现良好。",
        "notes": [],
        "document_conformity": None,
    }

    result = _parse_evaluation_json(json.dumps(payload, ensure_ascii=False), "标准")

    assert isinstance(result, dict)
    assert result["document_conformity"] is None


def test_joint_prompt_separates_document_from_work(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def fake_call(_client, _model: str, prompt: str) -> str:
        captured["prompt"] = prompt
        return json.dumps({
            "total_score": 0,
            "grade": "",
            "scores": [],
            "strengths": [],
            "weaknesses": [],
            "priority_suggestions": [],
            "brief_comment": "",
            "notes": [],
            "document_conformity": {"summary": "", "findings": []},
        })

    monkeypatch.setattr(ai_analyzer, "_call_ai", fake_call)
    ai_analyzer.evaluate_with_criteria(
        object(),
        "model",
        "作品证据",
        "评分标准",
        "说明文档内容",
        "说明.docx",
    )

    assert "【说明文档：说明.docx】" in captured["prompt"]
    assert "说明文档只能作为评分证据" in captured["prompt"]


def test_request_accepts_camel_case_supporting_document_fields() -> None:
    request = WorkAnalysisRequest.model_validate({
        "fileName": "work.mp4",
        "filePath": "work.mp4",
        "supportingDocumentName": "说明.pdf",
        "supportingDocumentText": "文档内容",
    })

    assert request.supporting_document_name == "说明.pdf"
    assert request.supporting_document_text == "文档内容"
    assert request.options.max_keyframes == 12


def test_joint_prompt_applies_input_budgets(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def fake_call(_client, _model: str, prompt: str) -> str:
        captured["prompt"] = prompt
        return "{}"

    monkeypatch.setattr(ai_analyzer, "_call_ai", fake_call)
    ai_analyzer.evaluate_with_criteria(
        object(),
        "model",
        "A" * 9000,
        "B" * 9000,
        "C" * 9000,
        "说明.pdf",
    )

    prompt = captured["prompt"]
    assert "A" * 7000 in prompt
    assert "A" * 7001 not in prompt
    assert "B" * 8000 in prompt
    assert "B" * 8001 not in prompt
    assert "C" * 6000 in prompt
    assert "C" * 6001 not in prompt
