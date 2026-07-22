"""OCR 文字识别"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from app.paddle_ocr_compat import create_paddle_ocr, recognize_paddle_text

if TYPE_CHECKING:
    from .frame_extractor import Keyframe

logger = logging.getLogger(__name__)


def ocr_keyframes(keyframes: list[Keyframe], use_paddle: bool = True) -> list[Keyframe]:
    """对关键帧进行 OCR 识别"""
    # 尝试使用 PaddleOCR
    if use_paddle:
        result = _ocr_with_paddle(keyframes)
        if result is not None and _has_usable_ocr(result):
            return result

    # 备用方案：使用 Tesseract
    result = _ocr_with_tesseract(keyframes)
    if result is not None:
        return result

    # 如果都没有安装，跳过 OCR
    logger.warning("No OCR engine available (PaddleOCR or Tesseract not installed). "
                   "OCR will be skipped. Install paddleocr or pytesseract for OCR support.")
    for kf in keyframes:
        kf.ocr_texts = []
        kf.ocr_summary = "(OCR not available - install paddleocr)"
    return keyframes


def _has_usable_ocr(keyframes: list[Keyframe]) -> bool:
    return any(kf.ocr_texts for kf in keyframes)


def _ocr_with_paddle(keyframes: list[Keyframe]) -> list[Keyframe] | None:
    """使用 PaddleOCR 进行文字识别"""
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        logger.debug("PaddleOCR not installed")
        return None

    try:
        logger.info("Loading PaddleOCR model...")
        reader = create_paddle_ocr()

        for i, kf in enumerate(keyframes):
            if not kf.path:
                continue

            logger.info("OCR [%d/%d] %.1fs...", i + 1, len(keyframes), kf.timestamp)
            try:
                texts = [
                    {"text": text, "confidence": round(confidence, 2)}
                    for text, confidence in recognize_paddle_text(reader, kf.path)
                    if confidence > 0.5
                ]

                kf.ocr_texts = texts
                kf.ocr_summary = " | ".join(t["text"] for t in texts[:5]) if texts else "(no text)"
            except Exception as e:
                logger.warning("OCR failed for frame %d: %s", i, e)
                kf.ocr_texts = []
                kf.ocr_summary = "(OCR unavailable)"

        return keyframes

    except Exception as e:
        logger.warning("Failed to initialize PaddleOCR: %s", e)
        return None


def _ocr_with_tesseract(keyframes: list[Keyframe]) -> list[Keyframe] | None:
    """使用 Tesseract 进行文字识别（备用方案）"""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        logger.debug("pytesseract/PIL not installed")
        return None

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
            kf.ocr_summary = "(OCR unavailable)"

    return keyframes
