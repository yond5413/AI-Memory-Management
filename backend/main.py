from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import os
import logging

# Load environment variables
load_dotenv(dotenv_path="../.env.local")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan handler for startup and shutdown events.
    Manages the job queue scheduler lifecycle.
    """
    # Startup
    from services.job_queue import get_job_queue_service
    from services.pdf_processing import PdfProcessingService
    from services.clustering_service import ClusteringService
    
    logger.info("Starting up AI Memory API Backend...")
    
    # Initialize and start the job queue service
    job_queue = get_job_queue_service()
    pdf_service = PdfProcessingService()
    clustering_service = ClusteringService()
    
    # Configure the job processor callback
    async def process_pdf_job(job):
        """Process a PDF job from the queue."""
        from services.job_queue import JobStatus
        
        try:
            # Update progress callback
            async def update_progress(processed: int, total: int):
                await job_queue.update_job_status(
                    job.job_id,
                    total_sections=total,
                    processed_sections=processed
                )
            
            # Process PDF with section detection
            result = await pdf_service.process_pdf_with_sections(
                file_content=job.file_content,
                filename=job.filename,
                user_id=job.user_id,
                progress_callback=lambda p, t: update_progress(p, t)
            )
            
            # Update final section count
            await job_queue.update_job_status(
                job.job_id,
                total_sections=result.get("sections_detected", 0),
                processed_sections=result.get("memories_created", 0)
            )
            
            # Trigger clustering after successful processing
            try:
                await clustering_service.run_clustering_for_user(job.user_id)
            except Exception as e:
                logger.warning(f"Clustering failed for user {job.user_id}: {e}")
                
            logger.info(f"Job {job.job_id} completed: {result}")
            
        except Exception as e:
            logger.error(f"Error processing job {job.job_id}: {e}")
            raise
    
    job_queue.configure(
        rate_limit_delay=2.0,  # 2 seconds between LLM calls
        max_retries=3,
        process_callback=process_pdf_job
    )
    job_queue.start()
    logger.info("Job queue service started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Memory API Backend...")
    job_queue.shutdown()
    logger.info("Job queue service stopped")


app = FastAPI(
    title="AI Memory API Backend",
    description="Intelligent memory management with PDF processing and LLM summarization",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import memories, profiles

app.include_router(memories.router)
app.include_router(profiles.router)


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "AI Memory API Backend",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
