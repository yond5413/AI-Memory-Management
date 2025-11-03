/** Memory service functions. */
import { getDb } from './mongodb';
import { createEmbedding } from './embeddings';
import { upsertEmbedding } from './pinecone';
import { genId } from '../utils';
import { Memory, MemoryCreate, MemoryStatus, MemoryDocument } from '../types';

/**
 * Create a new memory from text.
 */
export async function createMemory(memory: MemoryCreate): Promise<Memory> {
  const db = getDb();
  
  // Generate IDs
  const memoryId = genId('mem');
  const embeddingId = genId('vec');
  
  // Create embedding
  let embeddingVector: number[] = [];
  try {
    embeddingVector = await createEmbedding(memory.content);
    
    // Store embedding in Pinecone
    await upsertEmbedding(embeddingId, embeddingVector, {
      memory_id: memoryId,
      content: memory.content.substring(0, 200), // Store truncated content
      status: MemoryStatus.CURRENT,
    });
  } catch (error) {
    // Continue even if embedding fails for MVP
    console.warn('Warning: Embedding creation failed:', error);
  }
  
  // Create memory document
  const memoryDoc: MemoryDocument = {
    _id: memoryId,
    content: memory.content,
    embedding_id: embeddingId,
    status: MemoryStatus.CURRENT,
    supersedes: null,
    superseded_by: null,
    entity_id: null,
    metadata: memory.metadata || {},
    created_at: new Date(),
  };
  
  // Insert into MongoDB
  await db.collection('memories').insertOne(memoryDoc as any);
  
  // Return response
  return {
    id: memoryId,
    content: memoryDoc.content,
    embedding_id: memoryDoc.embedding_id,
    status: memoryDoc.status,
    supersedes: memoryDoc.supersedes,
    superseded_by: memoryDoc.superseded_by,
    entity_id: memoryDoc.entity_id,
    metadata: memoryDoc.metadata,
    created_at: memoryDoc.created_at,
  };
}

/**
 * Get a memory by ID.
 */
export async function getMemory(memoryId: string): Promise<Memory | null> {
  const db = getDb();
  
  const memoryDoc = await db.collection('memories').findOne({ _id: memoryId } as any);
  
  if (!memoryDoc) {
    return null;
  }
  
  return {
    id: String(memoryDoc._id),
    content: memoryDoc.content,
    embedding_id: memoryDoc.embedding_id,
    status: memoryDoc.status,
    supersedes: memoryDoc.supersedes,
    superseded_by: memoryDoc.superseded_by,
    entity_id: memoryDoc.entity_id,
    metadata: memoryDoc.metadata,
    created_at: memoryDoc.created_at,
  };
}

/**
 * Get all memories.
 */
export async function getAllMemories(): Promise<Memory[]> {
  const db = getDb();
  
  const memories = await db
    .collection('memories')
    .find({})
    .toArray();
  
  return memories.map((doc) => ({
    id: String(doc._id),
    content: doc.content,
    embedding_id: doc.embedding_id,
    status: doc.status,
    supersedes: doc.supersedes,
    superseded_by: doc.superseded_by,
    entity_id: doc.entity_id,
    metadata: doc.metadata,
    created_at: doc.created_at,
  }));
}

/**
 * Update a memory's status.
 */
export async function updateMemoryStatus(
  memoryId: string,
  status: MemoryStatus
): Promise<void> {
  const db = getDb();
  
  await db.collection('memories').updateOne(
    { _id: memoryId } as any,
    { $set: { status } }
  );
}

/**
 * Delete a memory.
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  const db = getDb();
  
  await db.collection('memories').deleteOne({ _id: memoryId } as any);
}

