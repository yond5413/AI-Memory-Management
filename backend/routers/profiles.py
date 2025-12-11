from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from services.memory_service import MemoryService
from dependencies import get_memory_service
from database import get_supabase

router = APIRouter(prefix="/profiles", tags=["Profiles"])

@router.get("/current")
async def get_current_profile(
    user_id: str,
    memory_service: MemoryService = Depends(get_memory_service)
):
    """
    Get the constructed Profile:
    1. Recent STM (Context)
    2. LTM Meta-Summary (Bio/Persona)
    """
    # 1. Get STM
    stm = await memory_service.get_stm_history(user_id, limit=5)
    
    # 2. Get LTM Meta-Summary from Supabase
    # We fetch the latest generated summary
    supabase = get_supabase()
    res = supabase.table("user_meta_summaries")\
        .select("summary")\
        .eq("user_id", user_id)\
        .order("generated_at", desc=True)\
        .limit(1)\
        .execute()
        
    ltm_summary = res.data[0]['summary'] if res.data else "No long-term profile generated yet."
    
    return {
        "short_term_context": [m['content'] for m in stm],
        "long_term_profile": ltm_summary
    }
