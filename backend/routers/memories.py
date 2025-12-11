from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException
from typing import Dict, Any, Optional
from services.memory_service import MemoryService
from services.pdf_processing import PdfProcessingService
from services.clustering_service import ClusteringService
from services.job_queue import get_job_queue_service, JobQueueService, JobStatus
from dependencies import get_memory_service, get_pdf_service, get_clustering_service

router = APIRouter(prefix="/memories", tags=["Memories"])


@router.post("/process-pdf")
async def process_pdf(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    use_smart_chunking: bool = Form(True),
    background_tasks: BackgroundTasks = None,
    pdf_service: PdfProcessingService = Depends(get_pdf_service),
    clustering_service: ClusteringService = Depends(get_clustering_service)
):
    """
    Upload PDF, extract memories using smart section-based chunking.
    
    Args:
        file: PDF file to process
        user_id: User ID for memory storage
        use_smart_chunking: If True, uses section-based chunking with summarization.
                           If False, uses legacy atomic extraction.
                           
    Returns:
        job_id for tracking progress (if smart chunking), or immediate processing result.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    content = await file.read()
    
    if use_smart_chunking:
        # Queue job for background processing with rate limiting
        job_queue = get_job_queue_service()
        
        try:
            job_id = await job_queue.create_job(
                user_id=user_id,
                filename=file.filename,
                file_content=content,
                metadata={"smart_chunking": True}
            )
            
            return {
                "status": "queued",
                "job_id": job_id,
                "filename": file.filename,
                "message": "PDF processing job created. Use /memories/job-status/{job_id} to track progress."
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create processing job: {str(e)}")
    else:
        # Legacy: process in background without job tracking
        background_tasks.add_task(
            _handle_pdf_background, 
            content, 
            file.filename, 
            user_id, 
            pdf_service, 
            clustering_service
        )
        
        return {"status": "processing_started", "filename": file.filename}


@router.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    """
    Get the status of a PDF processing job.
    
    Returns:
        - status: 'pending', 'processing', 'completed', or 'failed'
        - progress: processed_sections / total_sections
        - error_message: Error details if failed
    """
    job_queue = get_job_queue_service()
    
    job = await job_queue.get_job_status(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Calculate progress percentage
    total = job.get("total_sections", 0)
    processed = job.get("processed_sections", 0)
    progress_percent = (processed / total * 100) if total > 0 else 0
    
    return {
        "job_id": job_id,
        "status": job["status"],
        "filename": job.get("filename"),
        "progress": {
            "processed_sections": processed,
            "total_sections": total,
            "percent": round(progress_percent, 1)
        },
        "error_message": job.get("error_message"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at")
    }


@router.get("/jobs")
async def list_user_jobs(
    user_id: str,
    status: Optional[str] = None,
    limit: int = 10
):
    """
    List PDF processing jobs for a user.
    
    Args:
        user_id: User ID to fetch jobs for
        status: Optional filter by status ('pending', 'processing', 'completed', 'failed')
        limit: Maximum number of jobs to return
    """
    from database import get_supabase
    supabase = get_supabase()
    
    query = supabase.table("pdf_processing_jobs")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .limit(limit)
        
    if status:
        query = query.eq("status", status)
        
    result = query.execute()
    
    return {
        "jobs": result.data,
        "count": len(result.data)
    }


async def _handle_pdf_background(
    content: bytes, 
    filename: str, 
    user_id: str, 
    pdf_service: PdfProcessingService,
    clustering_service: ClusteringService
):
    """Legacy background handler for PDF processing."""
    try:
        # 1. Extract and Store Memories
        await pdf_service.process_pdf(content, filename, user_id)
        
        # 2. Trigger Clustering to update topics with new info
        await clustering_service.run_clustering_for_user(user_id)
        
        print(f"Successfully processed PDF {filename} for user {user_id}")
    except Exception as e:
        print(f"Error in background PDF processing: {e}")


@router.post("/stm")
async def add_short_term_memory(
    user_id: str = Form(...),
    content: str = Form(...),
    metadata: str = Form("{}"), # JSON string
    memory_service: MemoryService = Depends(get_memory_service)
):
    """
    Add a Short-Term Memory (Ephemeral).
    """
    import json
    try:
        meta_dict = json.loads(metadata)
    except:
        meta_dict = {}
        
    res = await memory_service.add_short_term_memory(user_id, content, meta_dict)
    return res
