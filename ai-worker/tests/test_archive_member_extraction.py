import zipfile

from app.content_analysis import extract_content


def test_zip_member_with_windows_invalid_name_is_extracted_safely(tmp_path) -> None:
    archive_path = tmp_path / "submission.zip"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("CON?.txt", "zip member content")

    result = extract_content([str(archive_path)])

    assert any(item.text == "zip member content" for item in result.evidence)
    assert not result.warnings
