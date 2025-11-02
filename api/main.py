"""FastAPI main application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import memories, relationships, search, derive

app = FastAPI(title="Semantic Memory API", version="0.1.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(memories.router, prefix="/memories", tags=["memories"])
app.include_router(relationships.router, prefix="/memories", tags=["relationships"])
app.include_router(search.router, prefix="", tags=["search"])
app.include_router(derive.router, prefix="", tags=["derive"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Semantic Memory API", "version": "0.1.0"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}

