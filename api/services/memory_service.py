"""Memory service functions."""
from api.models.memory import MemoryCreate, MemoryResponse, MemoryStatus
from api.services.mongo_client import get_db
from api.services.embeddings import create_embedding
from api.services.pinecone_client import upsert_embedding
from api.utils import gen_id
from datetime import datetime


async def create_memory_service(memory: MemoryCreate) -> MemoryResponse:
    """Create a new memory from text (service function)."""
    db = get_db()
    
    # Generate IDs
    memory_id = gen_id("mem")
    embedding_id = gen_id("vec")
    
    # Create embedding
    try:
        embedding_vector = create_embedding(memory.content)
        # Store embedding in Pinecone
        upsert_embedding(
            embedding_id=embedding_id,
            vector=embedding_vector,
            metadata={
                "memory_id": memory_id,
                "content": memory.content[:200],  # Store truncated content
                "status": MemoryStatus.CURRENT.value,
            }
        )
    except Exception as e:
        # Continue even if embedding fails for MVP
        print(f"Warning: Embedding creation failed: {e}")
        embedding_vector = []
    
    # Create memory document
    memory_doc = {
        "_id": memory_id,
        "content": memory.content,
        "embedding_id": embedding_id,
        "status": MemoryStatus.CURRENT.value,
        "supersedes": None,
        "superseded_by": None,
        "entity_id": None,
        "metadata": memory.metadata,
        "created_at": datetime.utcnow(),
    }
    
    # Insert into MongoDB
    db.memories.insert_one(memory_doc)
    
    # Return response
    return MemoryResponse(**{**memory_doc, "id": memory_id})


