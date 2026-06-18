from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class ArchiveCreate(BaseModel):
    url: HttpUrl
    tags: list[str] = Field(default_factory=list)


class ArchiveUpdate(BaseModel):
    user_memo: Optional[str] = None
    title: Optional[str] = None
    tags: Optional[list[str]] = None


class Archive(BaseModel):
    id: UUID
    url: str
    title: str
    og_image_url: Optional[str] = None
    favicon_url: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    user_memo: Optional[str] = None
    created_at: datetime
    tags: list[str] = Field(default_factory=list)
