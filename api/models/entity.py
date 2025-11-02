"""Pydantic models for Entity entities."""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class EntityResponse(BaseModel):
    """Response model for entity."""
    id: str
    name: str
    current_id: Optional[str] = None
    history: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class EntityDocument(BaseModel):
    """MongoDB document model for entity."""
    id: str
    name: str
    current_id: Optional[str] = None
    history: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

