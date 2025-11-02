"""Memory route handlers."""
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from api.models.memory import MemoryCreate, MemoryResponse, MemoryStatus
from api.services.mongo_client import get_db
from api.services.embeddings import create_embedding
from api.services.pinecone_client import upsert_embedding
from api.utils import gen_id
from datetime import datetime
from bson import ObjectId
import json

router = APIRouter()


def _memory_from_doc(doc: dict) -> dict:
    """Convert MongoDB document to memory response."""
    doc["id"] = str(doc.pop("_id", doc.get("id", "")))
    return doc


@router.post("", response_model=MemoryResponse)
async def create_memory(memory: MemoryCreate):
    """Create a new memory from text."""
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


@router.post("/from-pdf", response_model=MemoryResponse)
async def create_memory_from_pdf(file: UploadFile = File(...)):
    """Create a memory from PDF file."""
    from pypdf import PdfReader
    import io
    
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
    return await create_memory(memory)


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(memory_id: str):
    """Get a memory by ID."""
    db = get_db()
    
    memory_doc = db.memories.find_one({"_id": memory_id})
    if not memory_doc:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    return MemoryResponse(**{**memory_doc, "id": memory_id})


@router.get("/{memory_id}/lineage", response_model=dict)
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

