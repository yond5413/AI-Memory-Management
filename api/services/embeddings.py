"""Embedding service using Cohere."""
import cohere
from api.config import settings
from typing import List


_cohere_client = None


def get_cohere_client():
    """Get Cohere client instance."""
    global _cohere_client
    if _cohere_client is None:
        _cohere_client = cohere.Client(api_key=settings.cohere_api_key)
    return _cohere_client


def create_embedding(text: str) -> List[float]:
    """
    Create an embedding for the given text.
    
    Args:
        text: Text to embed
    
    Returns:
        List of float values representing the embedding vector
    """
    client = get_cohere_client()
    response = client.embed(
        texts=[text],
        model="embed-english-v3.0",
        input_type="search_document"
    )
    return response.embeddings[0]


