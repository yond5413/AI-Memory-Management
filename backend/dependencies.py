from functools import lru_cache
from services.memory_service import MemoryService
from services.clustering_service import ClusteringService
from services.pdf_processing import PdfProcessingService
from services.job_queue import get_job_queue_service, JobQueueService


@lru_cache()
def get_memory_service():
    return MemoryService()


@lru_cache()
def get_clustering_service():
    return ClusteringService()


@lru_cache()
def get_pdf_service():
    return PdfProcessingService()


def get_job_queue() -> JobQueueService:
    """Get the job queue service instance."""
    return get_job_queue_service()
