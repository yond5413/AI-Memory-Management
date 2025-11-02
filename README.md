# Semantic Memory System

A production-ready semantic memory system that enables persistent, connected, and evolving memory for AI systems. This system transforms unstructured natural language or PDF input into semantic memory objects with embeddings and relationships, supporting search, reasoning, and lineage tracking.

## Features

- **Memory Creation**: Accepts natural language or PDF input, converts into memory objects with embeddings
- **Relationship Linking**: Supports `update`, `extend`, and `derive` relations between memories
- **Semantic Search**: Vector-based similarity search using embeddings stored in Pinecone
- **Lineage Tracking**: Version history and evolution of facts over time
- **Graph Visualization**: Interactive memory graph built with React Flow
- **Embedding Display**: Show memory metadata and vector information for transparency

## Tech Stack

- **Backend**: FastAPI (Python)
- **Embedding Provider**: Cohere
- **Vector Database**: Pinecone
- **Document Store**: MongoDB
- **Frontend**: Next.js + React Flow
- **LLM (optional)**: OpenRouter for deriving insights

## Prerequisites

- Python 3.8+
- Node.js 18+
- MongoDB (local or cloud instance)
- Pinecone account and index
- Cohere API key
- OpenRouter API key (optional, for derivation)

## Setup

### 1. Clone and Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
npm install
```

### 2. Configure Environment Variables

Copy `ENV.example` to `.env` and fill in your credentials:

```bash
cp ENV.example .env
```

Edit `.env` with your actual values:

```env
COHERE_API_KEY=your_cohere_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_pinecone_index_name
PINECONE_ENVIRONMENT=us-east-1
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=memory_db
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 3. Setup Pinecone Index

Create a Pinecone index with:
- Dimension: 1024 (for Cohere embed-english-v3.0)
- Metric: cosine
- Index type: serverless

### 4. Setup MongoDB

Ensure MongoDB is running locally or update `MONGODB_URI` to point to your MongoDB instance.

## Running the Application

### Development Mode

Run both backend and frontend concurrently:

```bash
npm run dev
```

Or run separately:

```bash
# Terminal 1: Backend
npm run fastapi-dev

# Terminal 2: Frontend
npm run next-dev
```

- Backend API: http://localhost:8000
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

## API Endpoints

### Memories

- `POST /memories` - Create a memory from text
- `POST /memories/from-pdf` - Create a memory from PDF file
- `GET /memories/{id}` - Get a memory by ID
- `GET /memories/{id}/lineage` - Get memory lineage and relationships

### Relationships

- `POST /memories/{id}/relationships` - Create a relationship between memories

### Search

- `GET /search?q={query}` - Semantic search across memories

### Derivation

- `POST /derive` - Create derived memory from existing memories using LLM

## Example API Calls

### Create a Memory

```bash
curl -X POST "http://localhost:8000/memories" \
  -H "Content-Type: application/json" \
  -d '{"content": "I work at OpenAI."}'
```

### Search Memories

```bash
curl "http://localhost:8000/search?q=Where do I work?"
```

### Create Relationship

```bash
curl -X POST "http://localhost:8000/memories/{from_id}/relationships" \
  -H "Content-Type: application/json" \
  -d '{"to": "{to_id}", "type": "update", "description": "Updated employment info"}'
```

### Derive Memory

```bash
curl -X POST "http://localhost:8000/derive" \
  -H "Content-Type: application/json" \
  -d '["mem_id1", "mem_id2"]'
```

## Project Structure

```
├── api/                    # FastAPI backend
│   ├── main.py            # FastAPI app
│   ├── config.py          # Configuration
│   ├── utils.py           # Utilities
│   ├── routes/            # API routes
│   │   ├── memories.py
│   │   ├── relationships.py
│   │   ├── search.py
│   │   └── derive.py
│   ├── models/            # Pydantic models
│   │   ├── memory.py
│   │   ├── relationship.py
│   │   └── entity.py
│   └── services/          # Business logic
│       ├── mongo_client.py
│       ├── embeddings.py
│       ├── pinecone_client.py
│       └── llm.py
├── app/                    # Next.js frontend
│   ├── components/        # React components
│   ├── lib/               # API client
│   ├── hooks/             # React hooks
│   └── page.tsx           # Main dashboard
├── requirements.txt        # Python dependencies
└── package.json           # Node.js dependencies
```

## Data Model

### Memory

```json
{
  "id": "mem_abc123",
  "content": "I work at OpenAI.",
  "embedding_id": "vec_9fa2",
  "status": "current",
  "supersedes": "mem_001",
  "superseded_by": null,
  "entity_id": "ent_employment",
  "metadata": { "source": "user_input" },
  "created_at": "2025-11-01T19:00Z"
}
```

### Relationship

```json
{
  "id": "rel_8f9c22",
  "from_memory": "mem_001",
  "to_memory": "mem_abc123",
  "type": "update",
  "description": "Updated employment info",
  "created_at": "2025-11-01T19:01Z"
}
```

## Relationship Types

- **update**: Supersedes prior memory (versioning)
- **extend**: Adds contextual information without invalidating prior memory
- **derive**: LLM-generated insight based on other memories

## Memory Mutability Philosophy

- **Logical mutability, physical immutability**
- A new memory is created when information changes (e.g. "I work at Google" → "I work at OpenAI")
- The old memory is marked `outdated`, linked via an `update` relationship

## Future Extensions

- Authentication and user-level namespaces
- Memory summarization and compression
- Multi-entity linking (people, orgs, events)
- Time-based visualization (timeline + graph)
- Enhanced LLM-based derived insights and clustering

## License

MIT
