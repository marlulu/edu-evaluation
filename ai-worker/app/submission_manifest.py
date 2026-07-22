from __future__ import annotations

import mimetypes
import zipfile
import tempfile
from pathlib import Path

from pydantic import BaseModel, Field


class SubmissionFile(BaseModel):
    path: str
    source_path: str | None = None
    name: str
    extension: str
    modality: str
    supported: bool
    warnings: list[str] = Field(default_factory=list)


class SubmissionManifestRequest(BaseModel):
    file_paths: list[str] = Field(default_factory=list)
    object_keys: list[str] = Field(default_factory=list)
    rule_text: str = ""


class SubmissionManifest(BaseModel):
    files: list[SubmissionFile]
    warnings: list[str] = Field(default_factory=list)


_MODALITIES = {
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
    ".mp4": "video", ".mov": "video", ".avi": "video", ".mkv": "video",
    ".mp3": "audio", ".wav": "audio", ".m4a": "audio",
    ".pdf": "document", ".docx": "document", ".pptx": "document", ".xlsx": "document",
    ".txt": "text", ".md": "text", ".zip": "archive",
}


def build_manifest(paths: list[str]) -> SubmissionManifest:
    files: list[SubmissionFile] = []
    warnings: list[str] = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.is_file():
            warnings.append(f"File is unavailable: {path.name or raw_path}")
            continue
        _append_file(files, path, None)
        if path.suffix.lower() == ".zip":
            try:
                with zipfile.ZipFile(path) as archive:
                    for member in archive.infolist():
                        if member.is_dir():
                            continue
                        virtual = Path(member.filename)
                        _append_file(files, virtual, str(path))
            except zipfile.BadZipFile:
                warnings.append(f"Unreadable archive: {path.name}")
    return SubmissionManifest(files=files, warnings=warnings)


def download_object_keys(object_keys: list[str]) -> tuple[tempfile.TemporaryDirectory[str], list[str]]:
    """Download MinIO objects only for the lifetime of an analysis request."""
    from app.config import get_settings
    from minio import Minio

    settings = get_settings()
    if not settings.minio_endpoint or not settings.minio_access_key or not settings.minio_secret_key:
        raise ValueError("MinIO is not configured")
    directory = tempfile.TemporaryDirectory(prefix="submission-objects-")
    client = Minio(
        settings.minio_endpoint.replace("http://", "").replace("https://", ""),
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )
    paths: list[str] = []
    for index, key in enumerate(object_keys):
        target = Path(directory.name) / f"{index}-{Path(key).name}"
        client.fget_object(settings.minio_bucket, key, str(target))
        paths.append(str(target))
    return directory, paths


def _append_file(files: list[SubmissionFile], path: Path, source_path: str | None) -> None:
    extension = path.suffix.lower()
    modality = _MODALITIES.get(extension, "unsupported")
    files.append(SubmissionFile(
        path=str(path), source_path=source_path, name=path.name, extension=extension,
        modality=modality, supported=modality != "unsupported",
        warnings=[] if modality != "unsupported" else ["Unsupported file type"],
    ))
