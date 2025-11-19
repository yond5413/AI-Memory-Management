# PRD.md — Phase 2: Long-Term Memory System with Supabase + Neo4j + Pinecone

## 1. Overview

This phase introduces a robust long-term memory architecture to replace the previous MongoDB-based approach. The new system integrates:

- **Supabase** for authentication, profiles, namespaces, and canonical memory storage  
- **Pinecone** for embedding-based semantic retrieval  
- **Neo4j** for graph-based memory linking and relationship reasoning  
- **Next.js API layer** acting as the orchestrator  
- **Resume/document-to-memory ingestion**  
- **Conversation-based memory extraction**  
- **A chat interface to test memory recall and behavior**
- **System prompt customization** to evaluate agent performance with different instructions

Short-term memory is intentionally **excluded** in this phase.

The result is a system functionally similar to **Mem0** and **SuperMemory**, but significantly more flexible, open, and extensible.

---

## 2. Core Objectives

### ✔ Replace MongoDB with Neo4j + Supabase
Supabase becomes the system-of-record for users and memory content.  Neo4j becomes the relationship engine.

### ✔ Add persistent long-term memory
Memories are created from:
- user chat inputs
- resume uploads
- structured data
- manual additions

### ✔ Add document/resume-to-memories extraction
All documents (PDF, DOCX, plaintext) are chunked → summarized → stored as granular memories.

### ✔ Add a chat interface
Used to test:
- retrieval accuracy  
- graph-enhanced reasoning  
- user profiles improving responses  
- system prompt variations to evaluate different agent instructions

### ✔ Add stable user profiles
Not short-term context but canonical attributes:
- skills  
- work history  
- preferences  

### ✔ Form and maintain memory relationships
All related memories are connected in Neo4j to enable semantic reasoning and retrieval.

---

## 3. System Architecture

```
                   ┌───────────────────────┐
                   │      Next.js API      │
                   │ Memory Orchestrator   │
                   └──────────┬────────────┘
                              │
                 ┌────────────┼─────────────┐
                 │            │             │
        ┌────────▼───┐  ┌─────▼────────┐  ┌───────────────┐
        │  Supabase   │  │   Neo4j       │  │   Pinecone    │
        │(metadata)   │  │ (graph store) │  │ (embeddings)  │
        └─────────────┘  └───────────────┘  └───────────────┘
                │               │                │
                └───────┬───────┴────────────────┘
                        │
               ┌────────▼────────┐
               │   Chat / UI     │
               └──────────────────┘
```

### Responsibilities:

**Supabase**
- Auth  
- Profiles  
- Namespaces  
- Long-term memories  
- Metadata for chunked docs  

**Neo4j**
- Memory nodes  
- Relationship edges (`LIKES`, `WORKED_AT`, `PREFERS`, `MENTIONS`, `SUPERCEDES`, `EXTENDS`, `DERIVES`)  
- Semantic linking and graph-based reasoning  
- Graph traversal during retrieval  

**Pinecone**
- Embedding search  
- Fast nearest-neighbor retrieval  
- Namespace isolation per user  

---

## 4. Data Model

### 4.1 Supabase Tables

**profiles**
Stores user metadata and preferences.

```sql
id (PK, FK → auth.users)
display_name
avatar_url
preferred_llm
created_at
updated_at
```

---

**namespaces**
One user can have multiple memory spaces (like Mem0 "memory banks").

```sql
id (uuid)
user_id (FK)
name (text)
pinecone_namespace (text)
created_at
```

---

**memories**
Canonical source-of-truth for extracted memories.

```sql
id uuid pk
user_id fk
namespace_id fk
memory_type text      -- preference, fact, resume_fact, skill, etc.
content text
source text           -- conversation, resume, upload
embedding vector?     -- optional (local cache)
created_at
updated_at
```

---

**memory_chunks (optional)**
Chunked resume/doc data.

```sql
id uuid pk
memory_id fk
chunk_index int
chunk_text text
embedding vector
created_at
```

---

### 4.2 Neo4j Nodes

**Node: Memory**
```
(:Memory {
  id,
  user_id,
  type,
  content,
  created_at
})
```

**Node: Entity**
```
(:Entity {
  id,
  entity_type,
  name
})
```

**Relationships**
```
(:Memory)-[:RELATES_TO]->(:Memory)
(:Memory)-[:MENTIONS]->(:Entity)
(:Memory)-[:SUPERCEDES]->(:Memory)
(:Memory)-[:EXTENDS]->(:Memory)
(:Memory)-[:DERIVES]->(:Memory)
(:Entity)-[:CONNECTED_TO]->(:Entity)
```

Relationships are automatically created when new memories are ingested, based on similarity, type, and context, ensuring connected semantic graphs.

---

## 5. Memory Ingestion Flow

### 5.1 From Chat Message

1. User sends text  
2. LLM identifies potential memories  
3. Each memory is:
   - stored in Supabase `memories`
   - embedded → Pinecone
   - Neo4j edges created to related memories (`EXTENDS`, `DERIVES`, `SUPERCEDES`)  

### 5.2 From Resume or Document

1. Upload file  
2. System extracts raw text  
3. Chunk into sections  
4. For each chunk:  
   - Summarize into canonical memory units  
   - Add to `memories`  
   - Add embedding to Pinecone  
   - Create nodes & edges in Neo4j  
   - Form intra-document connections (`EXTENDS`, `DERIVES`)  

This ensures related memories are linked and contextually connected.

---

## 6. Retrieval Flow

1. Query embeddings from Pinecone (Top-K)  
2. Expand results using Neo4j graph traversal for related memories  
3. Fetch canonical memory texts from Supabase  
4. Apply system prompt (customizable per session)  
5. Pass context to LLM  
6. LLM generates final response  

Graph traversal and prompt customization ensure that related memories are leveraged effectively during reasoning.

---

## 7. Chat Interface Requirements

**Features:**
- Send messages  
- Toggle memory on/off  
- Update system prompt to test different instructions  
- View what memories were retrieved and their relationships  
- Test queries like:  
  - “Where does Yonathan work?”  
  - “What industries does he have experience in?”  
  - “What cuisine do I prefer?”  

**API Routes:**
```
POST /api/chat
POST /api/memory/update
POST /api/memory/ingest-document
POST /api/system-prompt/update
GET  /api/memory/search
```

---

## 8. LLM Requirements

The specific LLM **does not matter** as long as it supports:
- Extraction (“find memories from text”)  
- Summarization  
- Controlled output  
- System prompt injection  

Currently recommended:
- **Cohere Embed v3** for embeddings  
- **Gemini/OpenAI/Anthropic/OpenRouter** for LLM extraction  

---

## 9. Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

PINECONE_API_KEY=
PINECONE_INDEX_NAME=

NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=

EMBEDDING_MODEL_PROVIDER=cohere
COHERE_API_KEY=

LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
```

All verified—no “controller host” required unless hosting your own models.

---

## 10. Out of Scope (Phase 3)

- Short-term memory  
- Conversational thread memory windows  
- Role-based multi-user shared knowledge  
- Automated memory pruning / consolidation  
- Memory embeddings stored locally in Supabase  
- Real-time vector delta updates  

---

## 11. Acceptance Criteria

- Memories from chat stored in Supabase  
- Resume documents parsed and broken into multiple memories  
- Memories embedded → Pinecone  
- Graph nodes and relationships created in Neo4j  
- Related memories are properly linked (`SUPERCEDES`, `EXTENDS`, `DERIVES`)  
- Chat system shows improved recall when memory is enabled  
- User-specific namespaces created and used properly  
- System prompt can be updated and used during chat sessions  

---

## 12. Future Enhancements

- Memory importance scoring  
- Long-term vs short-term separation  
- Graph-based forgetting  
- Real-time events (“memory consolidation cron”)  
- Skills inference  
- Personality modeling

