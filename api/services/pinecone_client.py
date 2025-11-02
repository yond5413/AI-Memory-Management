"""Pinecone client for vector storage and search."""
from pinecone import Pinecone, ServerlessSpec
from api.config import settings
from typing import List, Dict, Any
import uuid


_pinecone_client = None
_index = None


def get_pinecone_client():
    """Get Pinecone client instance."""
    global _pinecone_client
    if _pinecone_client is None:
        _pinecone_client = Pinecone(api_key=settings.pinecone_api_key)
    return _pinecone_client


def get_index():
    """Get Pinecone index instance."""
    global _index
    if _index is None:
        pc = get_pinecone_client()
        try:
            _index = pc.Index(settings.pinecone_index_name)
        except Exception as e:
            # Index might not exist - will be created by user
            raise Exception(f"Pinecone index '{settings.pinecone_index_name}' not found. Please create it first.") from e
    return _index


def upsert_embedding(embedding_id: str, vector: List[float], metadata: Dict[str, Any]):
    """
    Upsert an embedding into Pinecone.
    
    Args:
        embedding_id: Unique identifier for the embedding
        vector: Embedding vector
        metadata: Metadata dictionary
    """
    index = get_index()
    index.upsert(
        vectors=[{
            "id": embedding_id,
            "values": vector,
            "metadata": metadata
        }]
    )


def search_embeddings(query_vector: List[float], top_k: int = 10) -> List[Dict[str, Any]]:
    """
    Search for similar embeddings.
    
    Args:
        query_vector: Query embedding vector
        top_k: Number of results to return
    
    Returns:
        List of matching results with scores and metadata
    """
    index = get_index()
    results = index.query(
        vector=query_vector,
        top_k=top_k,
        include_metadata=True
    )
    # Convert to list of dicts for easier handling
    matches = []
    for match in results.matches:
        matches.append({
            "id": match.id,
            "score": match.score,
            "metadata": match.metadata or {}
        })
    return matches

