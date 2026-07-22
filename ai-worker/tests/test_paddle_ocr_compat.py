from app.paddle_ocr_compat import recognize_paddle_text


def test_v3_predict_uses_supported_orientation_argument() -> None:
    class V3Reader:
        def __init__(self) -> None:
            self.arguments = None

        def predict(self, image_path: str, **kwargs):
            self.arguments = (image_path, kwargs)
            return [{"rec_texts": ["课堂作品"], "rec_scores": [0.97]}]

    reader = V3Reader()

    assert recognize_paddle_text(reader, "submission.jpeg") == [("课堂作品", 0.97)]
    assert reader.arguments == (
        "submission.jpeg",
        {"use_textline_orientation": True},
    )


def test_v2_ocr_is_used_only_when_predict_is_unavailable() -> None:
    class V2Reader:
        def __init__(self) -> None:
            self.arguments = None

        def ocr(self, image_path: str, **kwargs):
            self.arguments = (image_path, kwargs)
            return [[[[[0, 0], [1, 0], [1, 1], [0, 1]], ("旧版 OCR", 0.88)]]]

    reader = V2Reader()

    assert recognize_paddle_text(reader, "submission.jpeg") == [("旧版 OCR", 0.88)]
    assert reader.arguments == ("submission.jpeg", {"cls": True})
