# Semantic Memory System 

A production-ready semantic memory system that enables persistent, connected, and evolving memory for AI systems. This system transforms unstructured natural language or PDF input into semantic memory objects with embeddings and relationships, supporting search, reasoning, and lineage tracking.

**Phase 2 Architecture**: Next.js (Full Stack) + Neo4j (Source of Truth) + Pinecone (Vector) + Supabase (Auth/Metadata).

## Features

- **Memory Creation**: Accepts natural language or PDF input, converts into memory objects with embeddings
- **Relationship Linking**: Supports `update`, `extend`, and `derive` relations between memories in Neo4j
- **Semantic Search**: Vector-based similarity search using embeddings stored in Pinecone
- **Graph Visualization**: Interactive memory graph built with React Flow
- **Chat Interface**: Test memory retrieval and reasoning with a built-in chat UI and configurable system prompts
- **Document Ingestion**: PDF chunking and summarization for granular memory creation
- **Multi-User Support**: Supabase Auth with isolated namespaces per user

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database (Graph)**: Neo4j (AuraDB) - *Source of Truth for Memories*
- **Database (Auth/Meta)**: Supabase (Postgres)
- **Vector Database**: Pinecone
- **Embedding Provider**: Cohere (embed-english-v3.0)
- **LLM**: OpenRouter / z-ai/glm-4.5-air:free (for chat and derivation)
- **Frontend**: React + Tailwind CSS

## Prerequisites

- Node.js 18+
- Neo4j AuraDB Instance
- Supabase Project
- Pinecone Index
- Cohere API key
- OpenRouter API key

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env.local` with your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Neo4j
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# Pinecone
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=ai-memory

# AI Services
COHERE_API_KEY=your_cohere_key
OPENROUTER_API_KEY=your_openrouter_key
```

## Running the Application

```bash
npm run dev
```

- **Dashboard**: http://localhost:3000
- **Chat Interface**: http://localhost:3000/chat

## API Endpoints

### Memories
- `POST /api/memories` - Create a memory from text
- `POST /api/memories/from-pdf` - Create memories from PDF file (chunked)
- `GET /api/memories/{id}` - Get a memory by ID
- `GET /api/memories/graph` - Get full graph for visualization

### Chat
- `POST /api/chat` - Send message with memory retrieval (RAG)

### Search
- `GET /api/search?q={query}` - Semantic search across memories

## Architecture Overview

1. **Ingestion**: Text/PDF -> Chunking -> Embedding (Cohere) -> Vector Store (Pinecone) + Graph Store (Neo4j)
2. **Retrieval**: User Query -> Embedding -> Pinecone Search (Top K) -> Neo4j Expansion (Graph Traversal) -> Context Construction
3. **Generation**: Context + System Prompt + User History -> LLM -> Response

## License

MIT
