"""Pydantic models for Relationship entities."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class RelationshipType(str, Enum):
    """Relationship type enumeration."""
    UPDATE = "update"
    EXTEND = "extend"
    DERIVE = "derive"


class RelationshipBase(BaseModel):
    """Base relationship model."""
    to: str
    type: RelationshipType
    description: Optional[str] = None


class RelationshipCreate(RelationshipBase):
    """Request model for creating a relationship."""
    pass


class RelationshipResponse(BaseModel):
    """Response model for relationship."""
    id: str
    from_memory: str
    to_memory: str
    type: RelationshipType
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RelationshipDocument(BaseModel):
    """MongoDB document model for relationship."""
    id: str
    from_memory: str
    to_memory: str
    type: RelationshipType
    description: Optional[str] = None
    created_at: datetime


