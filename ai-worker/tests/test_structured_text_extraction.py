from app.content_analysis import extract_content


def test_markdown_text_is_emitted_as_locatable_sections(tmp_path) -> None:
    source = tmp_path / "report.md"
    source.write_text("# 作品说明\n\n这是第一部分。\n\n## 制作过程\n\n这是第二部分。", encoding="utf-8")

    result = extract_content([str(source)])
    sections = [item for item in result.evidence if item.modality == "text-section"]

    assert len(sections) == 2
    assert sections[0].metadata["heading"] == "作品说明"
    assert sections[0].locator.endswith("#paragraph=1-2")
    assert sections[1].metadata["heading"] == "制作过程"
