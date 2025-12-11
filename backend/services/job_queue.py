"""
Job Queue Service - APScheduler-based background task management for rate-limited LLM processing.

This service provides:
- Rate-limited job execution to avoid LLM API rate limits
- Job status tracking in Supabase
- Retry logic with exponential backoff
- Graceful handling of concurrent requests
"""

import asyncio
import logging
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database import get_supabase

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ProcessingJob:
    """Represents a PDF processing job in the queue."""
    job_id: str
    user_id: str
    filename: str
    file_content: bytes
    created_at: datetime = field(default_factory=datetime.now)
    retries: int = 0


class JobQueueService:
    """
    Manages background processing jobs with rate limiting using APScheduler.
    
    Key features:
    - In-memory job queue with Supabase persistence for status
    - Configurable rate limiting (delay between LLM calls)
    - Automatic retry with exponential backoff
    - Progress tracking
    """
    
    # Configuration
    RATE_LIMIT_DELAY_SECONDS: float = 2.0  # Delay between LLM calls
    MAX_RETRIES: int = 3
    RETRY_BACKOFF_MULTIPLIER: float = 2.0
    JOB_PROCESS_INTERVAL_SECONDS: float = 1.0  # How often to check for new jobs
    
    def __init__(self):
        self.supabase = get_supabase()
        self.scheduler: Optional[AsyncIOScheduler] = None
        self._job_queue: asyncio.Queue[ProcessingJob] = asyncio.Queue()
        self._is_processing: bool = False
        self._current_job: Optional[ProcessingJob] = None
        self._process_callback: Optional[Callable] = None
        
    def configure(
        self,
        rate_limit_delay: float = None,
        max_retries: int = None,
        process_callback: Callable = None
    ):
        """Configure the job queue service."""
        if rate_limit_delay is not None:
            self.RATE_LIMIT_DELAY_SECONDS = rate_limit_delay
        if max_retries is not None:
            self.MAX_RETRIES = max_retries
        if process_callback is not None:
            self._process_callback = process_callback
            
    def start(self):
        """Start the job queue scheduler."""
        if self.scheduler is None:
            self.scheduler = AsyncIOScheduler()
            
        # Add job processor that runs periodically
        self.scheduler.add_job(
            self._process_queue,
            trigger=IntervalTrigger(seconds=self.JOB_PROCESS_INTERVAL_SECONDS),
            id="job_queue_processor",
            replace_existing=True,
            max_instances=1  # Ensure only one instance runs at a time
        )
        
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("JobQueueService scheduler started")
            
    def shutdown(self):
        """Gracefully shutdown the scheduler."""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=True)
            logger.info("JobQueueService scheduler stopped")
            
    async def create_job(
        self,
        user_id: str,
        filename: str,
        file_content: bytes,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Create a new processing job and add it to the queue.
        
        Returns the job_id for status tracking.
        """
        # Create job record in Supabase
        job_data = {
            "user_id": user_id,
            "filename": filename,
            "status": JobStatus.PENDING.value,
            "total_sections": 0,
            "processed_sections": 0,
            "metadata": metadata or {}
        }
        
        result = self.supabase.table("pdf_processing_jobs").insert(job_data).execute()
        
        if not result.data:
            raise Exception("Failed to create job record in database")
            
        job_id = result.data[0]["id"]
        
        # Add to in-memory queue
        job = ProcessingJob(
            job_id=job_id,
            user_id=user_id,
            filename=filename,
            file_content=file_content
        )
        await self._job_queue.put(job)
        
        logger.info(f"Created job {job_id} for file {filename}")
        return job_id
        
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the current status of a job."""
        result = self.supabase.table("pdf_processing_jobs")\
            .select("*")\
            .eq("id", job_id)\
            .execute()
            
        return result.data[0] if result.data else None
        
    async def update_job_status(
        self,
        job_id: str,
        status: JobStatus = None,
        total_sections: int = None,
        processed_sections: int = None,
        error_message: str = None
    ):
        """Update job status in the database."""
        update_data = {"updated_at": datetime.now().isoformat()}
        
        if status is not None:
            update_data["status"] = status.value
        if total_sections is not None:
            update_data["total_sections"] = total_sections
        if processed_sections is not None:
            update_data["processed_sections"] = processed_sections
        if error_message is not None:
            update_data["error_message"] = error_message
            
        self.supabase.table("pdf_processing_jobs")\
            .update(update_data)\
            .eq("id", job_id)\
            .execute()
            
    async def _process_queue(self):
        """Process jobs from the queue (called by scheduler)."""
        if self._is_processing:
            return  # Already processing a job
            
        if self._job_queue.empty():
            return  # No jobs to process
            
        self._is_processing = True
        
        try:
            job = await self._job_queue.get()
            self._current_job = job
            
            logger.info(f"Processing job {job.job_id}")
            
            # Update status to processing
            await self.update_job_status(job.job_id, status=JobStatus.PROCESSING)
            
            # Call the processing callback if configured
            if self._process_callback:
                try:
                    await self._process_callback(job)
                    await self.update_job_status(job.job_id, status=JobStatus.COMPLETED)
                    logger.info(f"Job {job.job_id} completed successfully")
                except Exception as e:
                    logger.error(f"Job {job.job_id} failed: {e}")
                    
                    # Retry logic
                    if job.retries < self.MAX_RETRIES:
                        job.retries += 1
                        backoff = self.RETRY_BACKOFF_MULTIPLIER ** job.retries
                        logger.info(f"Retrying job {job.job_id} in {backoff}s (attempt {job.retries})")
                        await asyncio.sleep(backoff)
                        await self._job_queue.put(job)
                    else:
                        await self.update_job_status(
                            job.job_id,
                            status=JobStatus.FAILED,
                            error_message=str(e)
                        )
            else:
                logger.warning("No process callback configured")
                await self.update_job_status(
                    job.job_id,
                    status=JobStatus.FAILED,
                    error_message="No processor configured"
                )
                
        except Exception as e:
            logger.error(f"Error in queue processor: {e}")
        finally:
            self._is_processing = False
            self._current_job = None
            

class RateLimitedExecutor:
    """
    Executes async functions with rate limiting.
    
    Use this to wrap LLM API calls to ensure they don't exceed rate limits.
    """
    
    def __init__(self, min_delay_seconds: float = 2.0):
        self.min_delay_seconds = min_delay_seconds
        self._last_call_time: Optional[datetime] = None
        self._lock = asyncio.Lock()
        
    async def execute(self, func: Callable, *args, **kwargs) -> Any:
        """Execute a function with rate limiting."""
        async with self._lock:
            # Calculate time since last call
            if self._last_call_time:
                elapsed = (datetime.now() - self._last_call_time).total_seconds()
                if elapsed < self.min_delay_seconds:
                    wait_time = self.min_delay_seconds - elapsed
                    logger.debug(f"Rate limiting: waiting {wait_time:.2f}s")
                    await asyncio.sleep(wait_time)
                    
            # Execute the function
            self._last_call_time = datetime.now()
            return await func(*args, **kwargs)
            
    async def execute_batch(
        self,
        func: Callable,
        items: List[Any],
        progress_callback: Callable[[int, int], None] = None
    ) -> List[Any]:
        """
        Execute a function for each item with rate limiting.
        
        Args:
            func: Async function to call for each item
            items: List of items to process
            progress_callback: Optional callback(processed, total) for progress updates
            
        Returns:
            List of results from each function call
        """
        results = []
        total = len(items)
        
        for i, item in enumerate(items):
            result = await self.execute(func, item)
            results.append(result)
            
            if progress_callback:
                progress_callback(i + 1, total)
                
        return results


# Global instance (initialized in main.py)
job_queue_service: Optional[JobQueueService] = None
rate_limiter: Optional[RateLimitedExecutor] = None


def get_job_queue_service() -> JobQueueService:
    """Get the global job queue service instance."""
    global job_queue_service
    if job_queue_service is None:
        job_queue_service = JobQueueService()
    return job_queue_service


def get_rate_limiter(delay_seconds: float = 2.0) -> RateLimitedExecutor:
    """Get the global rate limiter instance."""
    global rate_limiter
    if rate_limiter is None:
        rate_limiter = RateLimitedExecutor(min_delay_seconds=delay_seconds)
    return rate_limiter
