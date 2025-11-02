"""LLM service for deriving insights using OpenRouter."""
import openai
from api.config import settings
from typing import List


def get_openai_client():
    """Get OpenAI client configured for OpenRouter."""
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key
    )


def derive_insight(memory_contents: List[str]) -> str:
    """
    Derive an insight from multiple memories using LLM.
    
    Args:
        memory_contents: List of memory content strings
    
    Returns:
        Derived insight text
    """
    if not settings.openrouter_api_key:
        # Fallback to simple concatenation if no API key
        return f"Derived insight from {len(memory_contents)} memories: {' '.join(memory_contents[:500])}"
    
    client = get_openai_client()
    
    # Combine memories as context
    context = "\n\n".join([f"Memory {i+1}: {content}" for i, content in enumerate(memory_contents)])
    
    # Create prompt for derivation
    prompt = f"""Based on the following memories, derive a new insight or conclusion:

{context}

Please provide a concise derived insight that synthesizes information from these memories:"""
    
    try:
        response = client.chat.completions.create(
            model="minimax/minimax-m2:free",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that derives insights from memories."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        # Fallback on error
        return f"Derived insight from {len(memory_contents)} memories: {' '.join(memory_contents[:500])}"

