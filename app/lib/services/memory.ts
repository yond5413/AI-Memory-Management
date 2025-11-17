/** Memory service functions. */
import { executeWrite, executeRead } from './neo4j';
import { createEmbedding } from './embeddings';
import { upsertEmbedding } from './pinecone';
import { genId } from '../utils';
import { Memory, MemoryCreate, MemoryStatus } from '../types';

interface Neo4jMemoryNode {
  m: {
    properties: {
      id: string;
      content: string;
      vector_id: string;
      status: string;
      supersedes: string | null;
      superseded_by: string | null;
      entity_id: string | null;
      metadata: string;
      created_at: string;
      updated_at: string;
    };
  };
}

/**
 * Create a new memory from text.
 */
export async function createMemory(
  memory: MemoryCreate,
  userId: string,
  namespace: string
): Promise<Memory> {
  // Generate IDs
  const memoryId = genId('mem');
  const embeddingId = genId('vec');
  
  // Create embedding
  let embeddingVector: number[] = [];
  try {
    embeddingVector = await createEmbedding(memory.content);
    
    // Store embedding in Pinecone with namespace
    await upsertEmbedding(
      embeddingId,
      embeddingVector,
      {
        memory_id: memoryId,
        content: memory.content.substring(0, 200), // Store truncated content
        status: MemoryStatus.CURRENT,
        namespace,
        user_id: userId,
      },
      namespace
    );
  } catch (error) {
    // Continue even if embedding fails for MVP
    console.warn('Warning: Embedding creation failed:', error);
  }
  
  const now = new Date().toISOString();
  
  // Create memory node in Neo4j with user ownership
  const cypher = `
    MERGE (u:User {id: $userId})
    CREATE (m:Memory {
      id: $id,
      content: $content,
      vector_id: $vector_id,
      status: $status,
      supersedes: $supersedes,
      superseded_by: $superseded_by,
      entity_id: $entity_id,
      namespace: $namespace,
      metadata: $metadata,
      created_at: datetime($created_at),
      updated_at: datetime($updated_at)
    })
    CREATE (u)-[:OWNS]->(m)
    RETURN m
  `;
  
  const results = await executeWrite<Neo4jMemoryNode>(cypher, {
    userId,
    id: memoryId,
    content: memory.content,
    vector_id: embeddingId,
    status: MemoryStatus.CURRENT,
    supersedes: null,
    superseded_by: null,
    entity_id: null,
    namespace,
    metadata: JSON.stringify(memory.metadata || {}),
    created_at: now,
    updated_at: now,
  });
  
  if (results.length === 0) {
    throw new Error('Failed to create memory node');
  }
  
  const node = results[0].m.properties;
  
  // Return response
  return {
    id: node.id,
    content: node.content,
    embedding_id: node.vector_id,
    status: node.status as MemoryStatus,
    supersedes: node.supersedes,
    superseded_by: node.superseded_by,
    entity_id: node.entity_id,
    metadata: JSON.parse(node.metadata),
    created_at: node.created_at,
  };
}

/**
 * Get a memory by ID (with optional namespace filtering).
 */
export async function getMemory(
  memoryId: string,
  namespace?: string
): Promise<Memory | null> {
  const cypher = namespace
    ? `MATCH (m:Memory {id: $id, namespace: $namespace}) RETURN m`
    : `MATCH (m:Memory {id: $id}) RETURN m`;
  
  const results = await executeRead<Neo4jMemoryNode>(cypher, { 
    id: memoryId,
    ...(namespace && { namespace }),
  });
  
  if (results.length === 0) {
    return null;
  }
  
  const node = results[0].m.properties;
  
  return {
    id: node.id,
    content: node.content,
    embedding_id: node.vector_id,
    status: node.status as MemoryStatus,
    supersedes: node.supersedes,
    superseded_by: node.superseded_by,
    entity_id: node.entity_id,
    metadata: JSON.parse(node.metadata),
    created_at: node.created_at,
  };
}

/**
 * Get all memories (filtered by namespace if provided).
 */
export async function getAllMemories(namespace?: string): Promise<Memory[]> {
  const cypher = namespace
    ? `MATCH (m:Memory {namespace: $namespace}) RETURN m ORDER BY m.created_at DESC`
    : `MATCH (m:Memory) RETURN m ORDER BY m.created_at DESC`;
  
  const results = await executeRead<Neo4jMemoryNode>(cypher, {
    ...(namespace && { namespace }),
  });
  
  return results.map((result) => {
    const node = result.m.properties;
    return {
      id: node.id,
      content: node.content,
      embedding_id: node.vector_id,
      status: node.status as MemoryStatus,
      supersedes: node.supersedes,
      superseded_by: node.superseded_by,
      entity_id: node.entity_id,
      metadata: JSON.parse(node.metadata),
      created_at: node.created_at,
    };
  });
}

/**
 * Update a memory's status (with optional namespace filtering).
 */
export async function updateMemoryStatus(
  memoryId: string,
  status: MemoryStatus,
  namespace?: string
): Promise<void> {
  const cypher = namespace
    ? `MATCH (m:Memory {id: $id, namespace: $namespace}) SET m.status = $status, m.updated_at = datetime($updated_at)`
    : `MATCH (m:Memory {id: $id}) SET m.status = $status, m.updated_at = datetime($updated_at)`;
  
  await executeWrite(cypher, {
    id: memoryId,
    status,
    updated_at: new Date().toISOString(),
    ...(namespace && { namespace }),
  });
}

/**
 * Delete a memory (with optional namespace filtering).
 */
export async function deleteMemory(memoryId: string, namespace?: string): Promise<void> {
  const cypher = namespace
    ? `MATCH (m:Memory {id: $id, namespace: $namespace}) DETACH DELETE m`
    : `MATCH (m:Memory {id: $id}) DETACH DELETE m`;
  
  await executeWrite(cypher, { 
    id: memoryId,
    ...(namespace && { namespace }),
  });
}

