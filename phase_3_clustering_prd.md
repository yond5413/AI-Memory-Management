# Phase 3 PRD — Automatic Memory Clustering & Relationship Formation

## **Overview**
Phase 3 introduces **automatic clustering**, **semantic grouping**, and **enhanced relationship formation** within the AI Memory Engine. The goal is to automatically organize a user's memories into meaningful categories, improve retrieval accuracy, and allow the system to reason at higher levels of abstraction.

This phase builds on the existing architecture:
- **Pinecone** → stores embeddings (one namespace per user)
- **Supabase** → stores memory metadata, cluster assignments, and cluster summaries
- **Neo4j** → stores relationships between memories and clusters
- **Next.js API** → orchestrates embedding, clustering, and graph creation

---

# 1. **Objectives**
### Primary Goals
- Implement automatic, unsupervised clustering of user memories
- Store cluster assignments and metadata in Supabase
- Represent clusters and their relationships in Neo4j
- Automatically generate cluster summaries to support high-level reasoning
- Improve retrieval by leveraging cluster context
- Strengthen memory relationship graphs

### Secondary Goals
- Improve agent performance via cluster-aware retrieval
- Support future long-term profiling and memory compression

---

# 2. **Clustering System Overview**
### Why Clustering?
- Embeddings capture semantic meaning, but a flat vector space becomes messy as memory count grows.
- Clustering:
  - groups related memories (e.g., sports, resume, food preferences)
  - improves retrieval efficiency
  - acts as an intermediate abstraction layer
  - enables the system to discover memory themes automatically

### Chosen Method: **HDBSCAN**
Rationale:
- No need to predefine number of clusters
- Handles semantic density well
- Identifies noise / unclustered memories
- Used by multiple production memory systems

Clustering runs in a background worker or server function.

---

# 3. **Data Flow**
### Step-by-step pipeline

1. **User adds a memory**
   - Text → embedding (Cohere / OpenAI)
   - Stored in Pinecone under namespace = `user_id`
   - Stored in Supabase table `memories`

2. **Periodic clustering job runs** (or triggered after N new memories)
   - Fetch all embeddings for `user_id` from Pinecone
   - Run HDBSCAN to generate `cluster_id` assignments

3. **Write cluster data to Supabase:**
   - `cluster_id`, `confidence`, `type`, timestamps
   - Create or update `memory_clusters` table

4. **Generate cluster summaries**
   - Prompt LLM to summarize each cluster
   - Insert into Supabase `cluster_summaries`

5. **Neo4j Relationship Creation**
   - Create nodes:
     - `(:Cluster {cluster_id})`
     - `(:Memory {memory_id})`
   - Create relationships:
     - `(:Memory)-[:BELONGS_TO]->(:Cluster)`
     - `(:Cluster)-[:RELATED_TO]->(:Cluster)` (if centroid similarity passes threshold)

6. **Enhanced Retrieval**
   - Determine most relevant clusters for query
   - Bias memory retrieval from those clusters
   - Retrieve cluster summary nodes for context

---

# 4. **Supabase Schema Additions**

## **Table: memory_clusters**
Stores cluster assignments for each memory.

| Column | Type | Description |
|--------|-------|-------------|
| id | uuid PK | Unique id |
| user_id | uuid FK | Owner |
| memory_id | uuid FK | Memory being clustered |
| cluster_id | text | Cluster label from HDBSCAN |
| confidence | float | Cluster confidence |
| created_at | timestamptz | Timestamp |
| updated_at | timestamptz | Timestamp |

## **Table: cluster_summaries**
Stores generated summaries for each cluster.

| Column | Type | Description |
|--------|-------|-------------|
| id | uuid PK | Unique id |
| user_id | uuid FK | Owner |
| cluster_id | text | Cluster label |
| summary | text | LLM-generated summary |
| embedding | vector (optional) | Embedding for summary |
| updated_at | timestamptz | Timestamp |

---

# 5. **Neo4j Graph Schema Updates**

## **Nodes**
- `(:Memory {id, text, created_at, ...})`
- `(:Cluster {cluster_id, summary, updated_at})`

## **Relationships**
- `(:Memory)-[:BELONGS_TO]->(:Cluster)`
- `(:Cluster)-[:RELATED_TO {similarity: float}]->(:Cluster)`
- Existing memory relationships remain:
  - `:SIMILAR_TO`
  - `:EXTENDS`
  - `:SUPERSEDES`
  - `:DERIVES_FROM`

---

# 6. **API Additions**

## **POST /api/memory/cluster/run**
Triggers a clustering job for all user memories.

### Response
```json
{
  "status": "ok",
  "clusters_updated": 12
}
```

## **GET /api/memory/cluster/:cluster_id**
Returns cluster details, summary, and memory list.

## **POST /api/memory/cluster/summary/:cluster_id**
Regenerates cluster summary using chosen LLM.

---

# 7. **Cluster Summarization**
Cluster summaries help the system reason at a higher level.

### Summary prompt example
```
You are summarizing a cluster of user memories.
Given these memory texts:
{{memory_list}}

Create a concise, factual summary that captures the theme.
```

### Optional advanced features
- hierarchical cluster summaries
- centroid-based auto summaries
- long-term profile generation using top-level clusters

---

# 8. **Retrieval Enhancements**
The retrieval pipeline becomes:

1. Query → embedding
2. Find top N similar memories
3. Identify top clusters involved
4. Retrieve cluster summary
5. Retrieve all cluster-linked memories via Neo4j
6. Return augmented context to agent

This dramatically improves:
- semantic recall
- cross-topic association
- reasoning accuracy

---

# 9. **Phase 3 Deliverables**
### Delivered
- HDBSCAN clustering pipeline
- Supabase schema for clusters + summaries
- Neo4j cluster graph representation
- Retrieval improvements
- Cluster summaries

### Deferred (future phases)
- short vs long-term profile differentiation
- memory compression
- cluster merging / splitting heuristics
- graph embeddings

---

# 10. **Success Metrics**
### Technical
- Cluster quality (silhouette score > 0.35)
- Retrieval accuracy improvement (expected ~20–40%)
- Neo4j query time under 50ms for cluster lookup

### UX
- Agent more consistent over longer sessions
- Cleaner graph visualization in ReactFlow

---

# 11. **Glossary**
- **Cluster**: Semantically related group of memories.
- **Cluster Summary**: LLM-generated theme description.
- **HDBSCAN**: Unsupervised density-based clustering algorithm.
- **Namespace**: User-specific vector partition in Pinecone.
- **BELONGS_TO**: Neo4j relationship linking memory to cluster.

---

# **End of Phase 3 PRD**
This document defines the full requirements, schemas, and workflows for adding semantic clustering and richer memory relationships to your AI Memory Engine. 

