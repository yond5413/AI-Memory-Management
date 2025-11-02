"""FastAPI main application entry point."""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from datetime import datetime
import io
from pypdf import PdfReader

# Import from utils
from api.utils.models.memory import MemoryCreate, MemoryResponse, MemoryStatus
from api.utils.models.relationship import RelationshipCreate, RelationshipResponse, RelationshipType
from api.utils.services.mongo_client import get_db
from api.utils.services.memory_service import create_memory_service
from api.utils.services.relationship_service import create_relationship_service
from api.utils.services.embeddings import create_embedding
from api.utils.services.pinecone_client import search_embeddings
from api.utils.services.llm import derive_insight

app = FastAPI(title="Semantic Memory API", version="0.1.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create API router with /api prefix
api_router = APIRouter(prefix="/api")


# Memory routes
@api_router.post("/memories", response_model=MemoryResponse)
async def create_memory(memory: MemoryCreate):
    """Create a new memory from text."""
    return await create_memory_service(memory)


@api_router.post("/memories/from-pdf", response_model=MemoryResponse)
async def create_memory_from_pdf(file: UploadFile = File(...)):
    """Create a memory from PDF file."""
    # Read PDF content
    contents = await file.read()
    pdf_reader = PdfReader(io.BytesIO(contents))
    
    # Extract text
    text_content = ""
    for page in pdf_reader.pages:
        text_content += page.extract_text() + "\n"
    
    if not text_content.strip():
        raise HTTPException(status_code=400, detail="PDF contains no extractable text")
    
    # Create memory from extracted text
    memory = MemoryCreate(content=text_content.strip(), metadata={"source": "pdf", "filename": file.filename})
    return await create_memory_service(memory)


@api_router.get("/memories/{memory_id}", response_model=MemoryResponse)
async def get_memory(memory_id: str):
    """Get a memory by ID."""
    db = get_db()
    
    memory_doc = db.memories.find_one({"_id": memory_id})
    if not memory_doc:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    return MemoryResponse(**{**memory_doc, "id": memory_id})


@api_router.get("/memories/{memory_id}/lineage", response_model=dict)
async def get_memory_lineage(memory_id: str):
    """Get memory lineage (all related memories)."""
    db = get_db()
    
    # Find memory
    memory = db.memories.find_one({"_id": memory_id})
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    # Find all relationships involving this memory
    relationships = list(db.relationships.find({
        "$or": [
            {"from_memory": memory_id},
            {"to_memory": memory_id}
        ]
    }))
    
    # Get all related memory IDs
    related_ids = set()
    for rel in relationships:
        related_ids.add(rel["from_memory"])
        related_ids.add(rel["to_memory"])
    
    # Fetch all related memories
    related_memories = list(db.memories.find({"_id": {"$in": list(related_ids)}}))
    
    # Convert to response format
    memories_response = [MemoryResponse(**{**mem, "id": mem["_id"]}) for mem in related_memories]
    relationships_response = [
        {
            "id": rel["_id"],
            "from_memory": rel["from_memory"],
            "to_memory": rel["to_memory"],
            "type": rel["type"],
            "description": rel.get("description"),
            "created_at": rel["created_at"].isoformat() if isinstance(rel.get("created_at"), datetime) else None,
        }
        for rel in relationships
    ]
    
    return {
        "memory": MemoryResponse(**{**memory, "id": memory_id}),
        "relationships": relationships_response,
        "related_memories": memories_response,
    }


# Relationship routes
@api_router.post("/memories/{from_memory_id}/relationships", response_model=RelationshipResponse)
async def create_relationship(from_memory_id: str, relationship: RelationshipCreate):
    """Create a relationship between two memories."""
    return await create_relationship_service(from_memory_id, relationship)


# Search routes
@api_router.get("/search", response_model=List[MemoryResponse])
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


# Derive routes
@api_router.post("/derive", response_model=MemoryResponse)
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
    derived_memory = await create_memory_service(memory_create)
    
    # Create derive relationships
    for memory_id in memory_ids:
        relationship = RelationshipCreate(
            to=derived_memory.id,
            type=RelationshipType.DERIVE,
            description=f"Derived from memory {memory_id}"
        )
        await create_relationship_service(memory_id, relationship)
    
    return derived_memory


# Mount API router
app.include_router(api_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Semantic Memory API", "version": "0.1.0"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
