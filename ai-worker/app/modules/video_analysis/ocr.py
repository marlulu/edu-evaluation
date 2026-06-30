"""OCR 文字识别"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .frame_extractor import Keyframe

logger = logging.getLogger(__name__)


def ocr_keyframes(keyframes: list[Keyframe], use_paddle: bool = True) -> list[Keyframe]:
    """对关键帧进行 OCR 识别"""
    if use_paddle:
        return _ocr_with_paddle(keyframes)
    return _ocr_with_tesseract(keyframes)


def _ocr_with_paddle(keyframes: list[Keyframe]) -> list[Keyframe]:
    """使用 PaddleOCR 进行文字识别"""
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        logger.warning("PaddleOCR not installed, skipping OCR")
        return keyframes

    try:
        logger.info("Loading PaddleOCR model...")
        reader = PaddleOCR(use_textline_orientation=True, lang="ch")

        for i, kf in enumerate(keyframes):
            if not kf.path:
                continue

            logger.info("OCR [%d/%d] %.1fs...", i + 1, len(keyframes), kf.timestamp)
            try:
                ocr_result = reader.ocr(kf.path, cls=True)
                texts = []
                if ocr_result and ocr_result[0]:
                    for line in ocr_result[0]:
                        bbox, (text, conf) = line[0], line[1]
                        if conf > 0.5:
                            texts.append({"text": text, "confidence": round(conf, 2)})

                kf.ocr_texts = texts
                kf.ocr_summary = " | ".join(t["text"] for t in texts[:5]) if texts else "(no text)"
            except Exception as e:
                logger.warning("OCR failed for frame %d: %s", i, e)
                kf.ocr_texts = []
                kf.ocr_summary = f"(OCR error: {e})"

    except Exception as e:
        logger.warning("Failed to initialize PaddleOCR: %s", e)

    return keyframes


def _ocr_with_tesseract(keyframes: list[Keyframe]) -> list[Keyframe]:
    """使用 Tesseract 进行文字识别（备用方案）"""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        logger.warning("pytesseract/PIL not installed, skipping OCR")
        return keyframes

    for i, kf in enumerate(keyframes):
        if not kf.path:
            continue

        try:
            img = Image.open(kf.path)
            text = pytesseract.image_to_string(img, lang="chi_sim+eng")
            kf.ocr_texts = [{"text": text.strip(), "confidence": 0.8}]
            kf.ocr_summary = text.strip()[:100] if text.strip() else "(no text)"
        except Exception as e:
            logger.warning("OCR failed for frame %d: %s", i, e)
            kf.ocr_texts = []
            kf.ocr_summary = f"(OCR error: {e})"

    return keyframes
