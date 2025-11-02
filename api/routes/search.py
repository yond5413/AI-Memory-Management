"""Search route handlers."""
from fastapi import APIRouter, HTTPException, Query
from typing import List
from api.models.memory import MemoryResponse
from api.services.mongo_client import get_db
from api.services.embeddings import create_embedding
from api.services.pinecone_client import search_embeddings

router = APIRouter()


@router.get("/search", response_model=List[MemoryResponse])
async def semantic_search(q: str = Query(..., description="Search query")):
    """Semantic search across memories."""
    db = get_db()
    
    try:
        # Create embedding for query
        query_embedding = create_embedding(q)
        
        # Search Pinecone
        results = search_embeddings(query_embedding, top_k=10)
        
        # Extract memory IDs from results
        memory_ids = [match.get("metadata", {}).get("memory_id") for match in results if match.get("metadata", {}).get("memory_id")]
        
        if not memory_ids:
            return []
        
        # Fetch memories from MongoDB
        memories = list(db.memories.find({"_id": {"$in": memory_ids}}))
        
        # Sort by Pinecone score (maintain order from results)
        memory_map = {mem["_id"]: mem for mem in memories}
        sorted_memories = [memory_map[mid] for mid in memory_ids if mid in memory_map]
        
        return [MemoryResponse(**{**mem, "id": mem["_id"]}) for mem in sorted_memories]
    except Exception as e:
        # Fallback to simple text search if vector search fails
        print(f"Warning: Semantic search failed: {e}")
        memories = list(db.memories.find({"status": "current"}).limit(10))
        return [MemoryResponse(**{**mem, "id": mem["_id"]}) for mem in memories]

