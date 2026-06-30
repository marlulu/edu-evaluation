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


def get_default_criteria(video_type: str) -> str:
    """返回内置默认评判标准"""
    if video_type == "defense":
        return DEFENSE_CRITERIA
    return WORK_CRITERIA


WORK_CRITERIA = """作品讲解视频默认评判标准：

1. 作品完整性（15分）
   - 功能是否完整可用
   - 有无明显缺失或bug
   - 是否达到预期目标

2. 创新性（15分）
   - 有无独特创意或设计
   - 与同类作品的差异点
   - 是否解决了新问题

3. 技术实现（15分）
   - 技术选型是否合理
   - 代码/实现质量如何
   - 是否使用了合适的技术栈

4. 讲解清晰度（15分）
   - 是否清晰阐述作品背景
   - 功能演示是否易懂
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


DEFENSE_CRITERIA = """答辩视频默认评判标准：

1. 问题定义（10分）
   - 研究问题是否清晰明确
   - 问题是否有研究价值和意义
   - 问题范围是否合理

2. 文献综述（10分）
   - 相关工作调研是否充分
   - 是否抓住了领域核心问题
   - 对比分析是否客观准确

3. 方法论述（15分）
   - 技术路线是否合理可行
   - 方法是否有创新点
   - 实现方案是否详细清晰

4. 实验与结果（15分）
   - 实验设计是否科学合理
   - 数据是否充分有说服力
   - 结论是否由数据支撑

5. 内容完整性（10分）
   - 各部分结构是否完整
   - 逻辑是否连贯递进
   - 有无遗漏重要内容

6. 回答能力（10分）
   - 回答是否准确切题
   - 表达是否有条理
   - 是否能应对追问

7. 时间控制（10分）
   - 各部分时长分配是否合理
   - 有无超时或过短
   - 重点部分是否充分展开

8. 表达能力（10分）
   - 语速是否适中
   - 停顿运用是否恰当
   - 口头禅是否过多
   - 语气是否有感染力

9. 专业知识（10分）
   - 专业术语使用是否准确
   - 对技术理解是否深入
   - 有无知识性错误"""
