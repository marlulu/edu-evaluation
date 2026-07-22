from __future__ import annotations

import json
import os
from typing import Any

# 禁用 OneDNN 后端以避免兼容性问题
os.environ.setdefault("FLAGS_use_mkldnn", "0")


def create_paddle_ocr() -> Any:
    from paddleocr import PaddleOCR

    try:
        return PaddleOCR(
            use_textline_orientation=True,
            lang="ch",
            enable_mkldnn=False,
        )
    except TypeError:
        return PaddleOCR(use_angle_cls=True, lang="ch", use_mkldnn=False)


def recognize_paddle_text(reader: Any, image_path: str) -> list[tuple[str, float]]:
    """Normalize PaddleOCR 2.x and 3.x output into text-confidence pairs."""
    if hasattr(reader, "predict"):
        return _extract_v3_results(
            reader.predict(image_path, use_textline_orientation=True)
        )

    legacy_results = reader.ocr(image_path, cls=True)
    return [
        (str(line[1][0]), float(line[1][1]))
        for page in legacy_results or []
        for line in page or []
        if line and len(line) > 1 and line[1]
    ]


def _extract_v3_results(results: list[Any]) -> list[tuple[str, float]]:
    lines: list[tuple[str, float]] = []
    for result in results:
        payload = _result_payload(result)
        texts = payload.get("rec_texts", [])
        scores = payload.get("rec_scores", [])
        if not isinstance(texts, list):
            continue
        for index, text in enumerate(texts):
            score = scores[index] if isinstance(scores, list) and index < len(scores) else 1.0
            try:
                lines.append((str(text), float(score)))
            except (TypeError, ValueError):
                lines.append((str(text), 1.0))
    return lines


def _result_payload(result: Any) -> dict[str, Any]:
    if isinstance(result, dict):
        return result
    payload = getattr(result, "json", {})
    if callable(payload):
        payload = payload()
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return {}
    return payload if isinstance(payload, dict) else {}
