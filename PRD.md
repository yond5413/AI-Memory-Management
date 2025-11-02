# 🧠 Semantic Memory System PRD

## 1. Overview

The **Semantic Memory System** enables persistent, connected, and evolving memory for AI systems. It transforms unstructured natural language or PDF input into semantic memory objects with embeddings and relationships, supporting search, reasoning, and lineage tracking.

This project serves as the foundation for an open, production-ready “memory layer” — comparable in concept to systems like Supermemory or Mem0.

---

## 2. Objectives

- **MVP Goal:** Build a minimal, functioning REST API and visualization dashboard that demonstrates the creation, linking, and semantic retrieval of memory nodes.
- **Stretch Goal:** Enable derived insights via LLM reasoning and maintain lineage visualization via React Flow.

---

## 3. Core Features

| Feature | Description |
|----------|--------------|
| **Memory Creation** | Accepts natural language or PDF input, converts into memory objects with embeddings. |
| **Relationship Linking** | Supports `update`, `extend`, and `derive` relations between memories. |
| **Semantic Search** | Vector-based similarity search using embeddings stored in Pinecone. |
| **Lineage Tracking** | Version history and evolution of facts over time. |
| **Graph Visualization** | Interactive memory graph built with React Flow. |
| **Embedding Display** | Show memory metadata and vector information for transparency. |

---

## 4. Tech Stack

| Layer | Tool | Role |
|-------|------|------|
| **API** | FastAPI (Python) | Core REST backend |
| **Embedding Provider** | Cohere | Semantic vector generation |
| **Vector Database** | Pinecone | Embedding storage and similarity search |
| **Document Store** | MongoDB | Memory, relationship, and metadata storage |
| **Frontend** | Next.js + React Flow | Graph visualization |
| **LLM (optional)** | OpenRouter | Derive new memories via reasoning |

---

## 5. Core Concepts

### 5.1 Memory Mutability Philosophy
- **Logical mutability, physical immutability.**
- A new memory is created when information changes (e.g. “I work at Google” → “I work at OpenAI”).  
- The old memory is marked `outdated`, linked via an `update` relationship.

### 5.2 Relationship Types

| Type | Description |
|------|--------------|
| **update** | Supersedes prior memory (versioning) |
| **extend** | Adds contextual information without invalidating prior memory |
| **derive** | LLM-generated insight based on other memories |

---

## 6. Data Model

### 6.1 Memory
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

### 6.2 Relationship
```json
{
  "id": "rel_8f9c22",
  "from": "mem_001",
  "to": "mem_abc123",
  "type": "update",
  "description": "Updated employment info",
  "created_at": "2025-11-01T19:01Z"
}
```

### 6.3 Entity
```json
{
  "id": "ent_employment",
  "name": "Employment",
  "current_id": "mem_abc123",
  "history": ["mem_001", "mem_abc123"]
}
```

---

## 7. API Design

| Method | Path | Purpose |
|---------|------|----------|
| `POST` | `/memories` | Create a memory from text or document |
| `GET` | `/memories/:id` | Retrieve a memory with relationships |
| `POST` | `/memories/:id/relationships` | Link two memories |
| `POST` | `/derive` | Create derived memory via LLM |
| `GET` | `/memories/:id/lineage` | Retrieve memory lineage |
| `GET` | `/search` | Semantic search across memories |

---

## 8. ER Diagram (Mermaid)

```mermaid
erDiagram

  Entity ||--o{ Memory : contains
  Memory ||--|| Embedding : has
  Memory ||--o{ Relationship : from
  Memory ||--o{ Relationship : to

  Entity {
    string id PK
    string name
    string current_id FK
    json metadata
  }

  Memory {
    string id PK
    string content
    string status
    string embedding_id FK
    string entity_id FK
    string supersedes
    string superseded_by
    datetime valid_from
    datetime valid_to
    json metadata
    datetime created_at
  }

  Relationship {
    string id PK
    string from FK
    string to FK
    string type
    string description
    datetime created_at
  }

  Embedding {
    string id PK
    string memory_id FK
    vector values
    json metadata
  }
```

---

## 9. ID Generation

Short, prefixed UUID-based IDs:

| Object | Prefix | Example |
|---------|---------|----------|
| Memory | `mem_` | `mem_3fa2b1` |
| Relationship | `rel_` | `rel_c4a91d` |
| Embedding | `vec_` | `vec_89b23a` |
| Entity | `ent_` | `ent_employment` |

Example generator (Python):
```python
import uuid, base64

def gen_id(prefix="mem"):
    raw = uuid.uuid4().bytes
    short = base64.urlsafe_b64encode(raw)[:8].decode("utf-8")
    return f"{prefix}_{short}"
```

---

## 10. End-to-End Example

### Step 1: Create a memory
```http
POST /memories
{
  "content": "I work at Google."
}
```

### Step 2: Update memory
```http
POST /memories
{
  "content": "I work at OpenAI."
}
→ creates new memory, marks old one outdated, links via `update`
```

### Step 3: Semantic search
```http
GET /search?q=Where do I work?
→ returns "I work at OpenAI."
```

### Step 4: Lineage retrieval
```http
GET /memories/mem_001/lineage
→ shows transition from Google → OpenAI
```

---

## 11. System Flow

```
[Input: Text or PDF]
        ↓
 [FastAPI Backend]
        ↓
  [Cohere Embedding] → [Pinecone Vector Store]
        ↓
  [MongoDB Document Store]
        ↓
  [Next.js + React Flow Frontend]
```

---

## 12. Folder Structure

```
/server
  main.py
  /routes
    memories.py
    relationships.py
    search.py
    derive.py
  /services
    embeddings.py
    llm.py
    pinecone_client.py
    mongo_client.py
    graph_ops.py
  /models
    memory.py
    relationship.py
    entity.py
```

---

## 13. MVP Deliverables

| Component | Deliverable |
|------------|--------------|
| **Backend** | Functional REST API with memory creation, search, and linking |
| **Vector DB Integration** | Embedding + Pinecone connection |
| **Frontend** | React Flow visualization with node selection and lineage view |
| **Docs** | README + architecture diagrams + example API calls |

---

## 14. Future Extensions

- Authentication and user-level namespaces
- Memory summarization and compression
- Multi-entity linking (people, orgs, events)
- Time-based visualization (timeline + graph)
- LLM-based derived insights and clustering

---

## 15. Summary

This system forms the **memory substrate** for any intelligent application.  
It combines **semantic vector search**, **graph relationships**, and **temporal versioning** into one cohesive framework.

When fully built, it can power assistants, research copilots, and AI reasoning agents — giving them persistent, transparent memory.

---
