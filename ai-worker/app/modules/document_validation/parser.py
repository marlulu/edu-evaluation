from __future__ import annotations

import mimetypes
import time
from io import BytesIO
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

from .schemas import (
    DocumentHeading,
    DocumentParseResult,
    DocumentStatistics,
    DocumentTable,
)

SUPPORTED_EXTENSIONS = {".docx", ".pdf", ".txt", ".md"}
MAX_RESULT_CHARACTERS = 500_000
MAX_DOCX_IMAGES = 12
PDF_RENDER_DPI = 110
VISION_IMAGE_MAX_EDGE = 1600
VISION_JPEG_QUALITY = 78
DOCX_IMAGE_EXTENSIONS = {
    "image/bmp": ".bmp",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/tiff": ".tiff",
    "image/webp": ".webp",
}


class DocumentParseError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def extract_docx_images(
    path: Path,
    output_dir: Path,
    max_images: int = MAX_DOCX_IMAGES,
) -> list[Path]:
    """Extract supported embedded DOCX images to a task-owned directory."""
    document = Document(path)
    output_dir.mkdir(parents=True, exist_ok=True)
    image_paths: list[Path] = []

    for relation in document.part.rels.values():
        if not relation.reltype.endswith("/image"):
            continue
        content_type = relation.target_part.content_type
        extension = DOCX_IMAGE_EXTENSIONS.get(content_type)
        if extension is None:
            continue

        image_path = output_dir / f"image_{len(image_paths) + 1:02d}.jpg"
        try:
            from PIL import Image

            with Image.open(BytesIO(relation.target_part.blob)) as image:
                _save_vision_jpeg(image, image_path)
            image_paths.append(image_path)
        except Exception:
            continue
        if len(image_paths) >= max_images:
            break

    return image_paths


def extract_pdf_images(
    path: Path,
    output_dir: Path,
    max_images: int = MAX_DOCX_IMAGES,
) -> list[Path]:
    """Render representative PDF pages as ordered visual keyframes."""
    import pdfplumber

    output_dir.mkdir(parents=True, exist_ok=True)
    image_paths: list[Path] = []
    with pdfplumber.open(path) as pdf:
        for page_index in _representative_page_indexes(len(pdf.pages), max_images):
            try:
                page = pdf.pages[page_index]
                output_path = output_dir / f"page_{page_index + 1:04d}.jpg"
                rendered = page.to_image(resolution=PDF_RENDER_DPI).original
                _save_vision_jpeg(rendered, output_path)
                image_paths.append(output_path)
            except Exception:
                continue
    return image_paths


def _representative_page_indexes(page_count: int, max_pages: int) -> list[int]:
    if page_count <= 0 or max_pages <= 0:
        return []
    if page_count <= max_pages:
        return list(range(page_count))
    step = (page_count - 1) / (max_pages - 1)
    return [round(index * step) for index in range(max_pages)]


def _save_vision_jpeg(image, output_path: Path) -> None:
    """Bound visual evidence size before embedding it in a model request."""
    from PIL import Image

    if image.mode not in ("RGB", "L"):
        background = Image.new("RGB", image.size, "white")
        if "A" in image.getbands():
            background.paste(image, mask=image.getchannel("A"))
        else:
            background.paste(image)
        image = background
    elif image.mode == "L":
        image = image.convert("RGB")

    image.thumbnail((VISION_IMAGE_MAX_EDGE, VISION_IMAGE_MAX_EDGE), Image.Resampling.LANCZOS)
    image.save(output_path, "JPEG", quality=VISION_JPEG_QUALITY, optimize=True)


def parse_document(path: Path, original_name: str, file_size: int) -> DocumentParseResult:
    started = time.perf_counter()
    extension = Path(original_name).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        message = (
            "不支持旧版 .doc，请转换为 .docx 后重试。"
            if extension == ".doc"
            else "仅支持 DOCX、PDF、TXT 和 Markdown 文件。"
        )
        raise DocumentParseError("UNSUPPORTED_FORMAT", message)

    try:
        if extension == ".docx":
            text, headings, tables, paragraphs, pages, parser_name = _parse_docx(path)
        elif extension == ".pdf":
            text, headings, tables, paragraphs, pages, parser_name = _parse_pdf(path)
        else:
            text, headings, tables, paragraphs, pages, parser_name = _parse_text(path)
    except DocumentParseError:
        raise
    except Exception as exc:
        raise DocumentParseError("PARSE_FAILED", f"文档解析失败：{exc}") from exc

    if not text.strip():
        raise DocumentParseError("EMPTY_CONTENT", "未提取到可用文字内容。")

    warnings: list[str] = []
    if len(text) > MAX_RESULT_CHARACTERS:
        text = text[:MAX_RESULT_CHARACTERS]
        warnings.append("提取内容过长，预览已截断为 500000 个字符。")

    mime_type = mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    return DocumentParseResult(
        file_name=original_name,
        format=extension.removeprefix("."),
        mime_type=mime_type,
        file_size=file_size,
        parser=parser_name,
        duration_ms=round((time.perf_counter() - started) * 1000),
        text=text,
        headings=headings,
        tables=tables,
        statistics=DocumentStatistics(
            characters=len(text),
            paragraphs=paragraphs,
            tables=len(tables),
            pages=pages,
        ),
        warnings=warnings,
    )


def _parse_docx(
    path: Path,
) -> tuple[str, list[DocumentHeading], list[DocumentTable], int, None, str]:
    document = Document(path)
    text_parts: list[str] = []
    headings: list[DocumentHeading] = []
    tables: list[DocumentTable] = []
    paragraph_count = 0

    for child in document.element.body.iterchildren():
        if child.tag.endswith("}p"):
            paragraph = Paragraph(child, document)
            value = paragraph.text.strip()
            if not value:
                continue
            paragraph_count += 1
            text_parts.append(value)
            style_name = paragraph.style.name if paragraph.style else ""
            if style_name.lower().startswith("heading"):
                suffix = style_name.removeprefix("Heading").strip()
                level = int(suffix) if suffix.isdigit() else 1
                headings.append(DocumentHeading(level=level, text=value))
        elif child.tag.endswith("}tbl"):
            table = Table(child, document)
            rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
            tables.append(DocumentTable(rows=rows))
            text_parts.extend("\t".join(row) for row in rows if any(row))

    return "\n".join(text_parts), headings, tables, paragraph_count, None, "python-docx"


def _parse_pdf(
    path: Path,
) -> tuple[str, list[DocumentHeading], list[DocumentTable], int, int, str]:
    import pdfplumber

    page_texts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_texts.append(page.extract_text() or "")
        page_count = len(pdf.pages)
    text = "\n\n".join(value.strip() for value in page_texts if value.strip())
    paragraph_count = len([value for value in text.splitlines() if value.strip()])
    return text, [], [], paragraph_count, page_count, "pdfplumber"


def _parse_text(
    path: Path,
) -> tuple[str, list[DocumentHeading], list[DocumentTable], int, None, str]:
    raw = path.read_bytes()
    text: str | None = None
    used_encoding = ""
    for encoding in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            text = raw.decode(encoding)
            used_encoding = encoding
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise DocumentParseError("INVALID_ENCODING", "无法识别文本文件编码。")

    headings: list[DocumentHeading] = []
    if path.suffix.lower() == ".md":
        for line in text.splitlines():
            stripped = line.lstrip()
            marker = len(stripped) - len(stripped.lstrip("#"))
            if 1 <= marker <= 6 and stripped[marker:].startswith(" "):
                headings.append(
                    DocumentHeading(level=marker, text=stripped[marker:].strip())
                )
    paragraph_count = len([value for value in text.splitlines() if value.strip()])
    return text, headings, [], paragraph_count, None, f"text/{used_encoding}"
