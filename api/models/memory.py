"""Pydantic models for Memory entities."""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class MemoryStatus(str, Enum):
    """Memory status enumeration."""
    CURRENT = "current"
    OUTDATED = "outdated"


class MemoryBase(BaseModel):
    """Base memory model."""
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MemoryCreate(MemoryBase):
    """Request model for creating a memory."""
    pass


class MemoryResponse(BaseModel):
    """Response model for memory."""
    id: str
    content: str
    embedding_id: str
    status: MemoryStatus
    supersedes: Optional[str] = None
    superseded_by: Optional[str] = None
    entity_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True


class MemoryDocument(BaseModel):
    """MongoDB document model for memory."""
    id: str
    content: str
    embedding_id: str
    status: MemoryStatus
    supersedes: Optional[str] = None
    superseded_by: Optional[str] = None
    entity_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


