from pydantic import BaseModel, Field


class DocumentHeading(BaseModel):
    level: int
    text: str


class DocumentTable(BaseModel):
    rows: list[list[str]]


class DocumentStatistics(BaseModel):
    characters: int
    paragraphs: int
    tables: int
    pages: int | None = None


class DocumentParseResult(BaseModel):
    success: bool = True
    file_name: str = Field(serialization_alias="fileName")
    format: str
    mime_type: str = Field(serialization_alias="mimeType")
    file_size: int = Field(serialization_alias="fileSize")
    parser: str
    duration_ms: int = Field(serialization_alias="durationMs")
    text: str
    headings: list[DocumentHeading]
    tables: list[DocumentTable]
    statistics: DocumentStatistics
    warnings: list[str]
