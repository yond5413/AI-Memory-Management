"""Relationship route handlers."""
from fastapi import APIRouter, HTTPException
from api.models.relationship import RelationshipCreate, RelationshipResponse
from api.models.memory import MemoryStatus
from api.services.mongo_client import get_db
from api.utils import gen_id
from datetime import datetime

router = APIRouter()


@router.post("/{from_memory_id}/relationships", response_model=RelationshipResponse)
async def create_relationship(from_memory_id: str, relationship: RelationshipCreate):
    """Create a relationship between two memories."""
    db = get_db()
    
    # Verify both memories exist
    from_memory = db.memories.find_one({"_id": from_memory_id})
    to_memory = db.memories.find_one({"_id": relationship.to})
    
    if not from_memory:
        raise HTTPException(status_code=404, detail="From memory not found")
    if not to_memory:
        raise HTTPException(status_code=404, detail="To memory not found")
    
    # Handle update relationship - mark old memory as outdated
    if relationship.type == "update":
        db.memories.update_one(
            {"_id": from_memory_id},
            {
                "$set": {
                    "status": MemoryStatus.OUTDATED.value,
                    "superseded_by": relationship.to
                }
            }
        )
        db.memories.update_one(
            {"_id": relationship.to},
            {"$set": {"supersedes": from_memory_id}}
        )
    
    # Create relationship document
    relationship_id = gen_id("rel")
    relationship_doc = {
        "_id": relationship_id,
        "from_memory": from_memory_id,
        "to_memory": relationship.to,
        "type": relationship.type.value,
        "description": relationship.description,
        "created_at": datetime.utcnow(),
    }
    
    # Insert into MongoDB
    db.relationships.insert_one(relationship_doc)
    
    return RelationshipResponse(**{**relationship_doc, "id": relationship_id})

