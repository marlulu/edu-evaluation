"""OCR 文字识别"""


def ocr_keyframes(keyframes: list[dict]) -> list[dict]:
    """对关键帧进行 OCR 识别"""
    from paddleocr import PaddleOCR

    print("      Loading PaddleOCR model...")
    reader = PaddleOCR(use_textline_orientation=True, lang="ch")

    results = []
    for i, kf in enumerate(keyframes):
        print(f"      OCR [{i+1}/{len(keyframes)}] {kf['timestamp']}s...")
        try:
            ocr_result = reader.ocr(kf["path"], cls=True)
            texts = []
            if ocr_result and ocr_result[0]:
                for line in ocr_result[0]:
                    bbox, (text, conf) = line[0], line[1]
                    if conf > 0.5:
                        texts.append({"text": text, "confidence": round(conf, 2)})

            kf["ocr_texts"] = texts
            kf["ocr_summary"] = " | ".join(t["text"] for t in texts[:5]) if texts else "(no text)"
        except Exception as e:
            kf["ocr_texts"] = []
            kf["ocr_summary"] = f"(OCR error: {e})"

        results.append(kf)

    return results
