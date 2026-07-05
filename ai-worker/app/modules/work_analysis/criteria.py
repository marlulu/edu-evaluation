"""评判标准解析与默认标准"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def parse_criteria_file(file_path: str) -> str:
    """从 PDF 或 Word 文件中提取评判标准文本"""
    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        return _parse_pdf(file_path)
    elif ext in (".docx", ".doc"):
        return _parse_docx(file_path)
    else:
        return _parse_text(file_path)


def _parse_pdf(file_path: str) -> str:
    """解析 PDF 文件"""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except ImportError:
        logger.warning("PyPDF2 not installed, cannot parse PDF")
        return ""
    except Exception as e:
        logger.warning("Failed to parse PDF: %s", e)
        return ""


def _parse_docx(file_path: str) -> str:
    """解析 Word 文件"""
    try:
        from docx import Document
        doc = Document(file_path)
        text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())
        return text.strip()
    except ImportError:
        logger.warning("python-docx not installed, cannot parse Word file")
        return ""
    except Exception as e:
        logger.warning("Failed to parse Word file: %s", e)
        return ""


def _parse_text(file_path: str) -> str:
    """解析纯文本文件"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception as e:
        logger.warning("Failed to read text file: %s", e)
        return ""


def get_default_criteria() -> str:
    """返回内置默认评判标准"""
    return DEFAULT_CRITERIA


DEFAULT_CRITERIA = """视频默认评判标准：

1. 内容完整性（15分）
   - 内容是否完整
   - 有无明显缺失
   - 是否达到预期目标

2. 创新性（15分）
   - 有无独特创意或设计
   - 与同类作品的差异点
   - 是否解决了新问题

3. 技术实现（15分）
   - 技术选型是否合理
   - 实现质量如何
   - 是否使用了合适的技术栈

4. 讲解清晰度（15分）
   - 是否清晰阐述背景
   - 演示是否易懂
   - 重点亮点是否突出

5. 演示效果（10分）
   - 操作是否流畅
   - 界面是否美观
   - 有无演示事故

6. 实用价值（10分）
   - 是否解决实际问题
   - 是否有应用场景
   - 用户体验如何

7. 表达能力（10分）
   - 语速是否适中
   - 停顿运用是否恰当
   - 口头禅是否过多
   - 语气是否有感染力

8. 专业知识（10分）
   - 专业术语使用是否准确
   - 对技术理解是否深入
   - 有无知识性错误"""
