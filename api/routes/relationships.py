"""Relationship route handlers."""
from fastapi import APIRouter
from api.models.relationship import RelationshipCreate, RelationshipResponse
from api.services.relationship_service import create_relationship_service

router = APIRouter()


@router.post("/{from_memory_id}/relationships", response_model=RelationshipResponse)
async def create_relationship(from_memory_id: str, relationship: RelationshipCreate):
    """Create a relationship between two memories."""
    return await create_relationship_service(from_memory_id, relationship)

