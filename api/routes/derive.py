"""Derive route handlers."""
from fastapi import APIRouter, HTTPException
from api.models.memory import MemoryCreate, MemoryResponse
from api.models.relationship import RelationshipCreate
from api.services.mongo_client import get_db
from api.services.llm import derive_insight
from api.routes.memories import create_memory
from typing import List

router = APIRouter()


@router.post("/derive", response_model=MemoryResponse)
async def derive_memory(memory_ids: List[str]):
    """Create a derived memory from existing memories using LLM."""
    db = get_db()
    
    # Verify all memories exist
    memories = list(db.memories.find({"_id": {"$in": memory_ids}}))
    if len(memories) != len(memory_ids):
        raise HTTPException(status_code=404, detail="One or more memories not found")
    
    # Extract memory contents
    memory_contents = [mem["content"] for mem in memories]
    
    # Derive insight using LLM
    derived_content = derive_insight(memory_contents)
    
    # Create derived memory
    memory_create = MemoryCreate(
        content=derived_content,
        metadata={"source": "derived", "based_on": memory_ids}
    )
    derived_memory = await create_memory(memory_create)
    
    # Create derive relationships
    for memory_id in memory_ids:
        relationship = RelationshipCreate(
            to=derived_memory.id,
            type="derive",
            description=f"Derived from memory {memory_id}"
        )
        # Import here to avoid circular dependency
        from api.routes.relationships import create_relationship
        await create_relationship(memory_id, relationship)
    
    return derived_memory

