"""FastAPI main application."""
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from api.routes import memories, relationships, search, derive

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
api_router.include_router(memories.router, prefix="/memories", tags=["memories"])
api_router.include_router(relationships.router, prefix="/memories", tags=["relationships"])
api_router.include_router(search.router, prefix="", tags=["search"])
api_router.include_router(derive.router, prefix="", tags=["derive"])

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

