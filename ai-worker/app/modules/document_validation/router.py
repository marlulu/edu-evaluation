from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from .parser import DocumentParseError, parse_document
from .schemas import DocumentParseResult

router = APIRouter(prefix="/document-validation", tags=["document-validation"])

MAX_FILE_SIZE = 100 * 1024 * 1024
READ_CHUNK_SIZE = 1024 * 1024


@router.post(
    "/parse",
    response_model=DocumentParseResult,
    response_model_by_alias=True,
)
async def validate_document(file: UploadFile = File(...)) -> DocumentParseResult:
    original_name = Path(file.filename or "document").name
    suffix = Path(original_name).suffix.lower()
    temporary_path: Path | None = None
    file_size = 0

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary_file:
            temporary_path = Path(temporary_file.name)
            while chunk := await file.read(READ_CHUNK_SIZE):
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="文件不能超过 100 MB。")
                temporary_file.write(chunk)

        try:
            return parse_document(temporary_path, original_name, file_size)
        except DocumentParseError as exc:
            status_code = 415 if exc.code == "UNSUPPORTED_FORMAT" else 422
            raise HTTPException(
                status_code=status_code,
                detail={"code": exc.code, "message": str(exc)},
            ) from exc
    finally:
        await file.close()
        if temporary_path is not None:
            try:
                os.unlink(temporary_path)
            except FileNotFoundError:
                pass
