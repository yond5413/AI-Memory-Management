/** Pinecone client for vector storage and search. */
import { Pinecone, Index } from '@pinecone-database/pinecone';
import { getEnv } from '../utils';
import { PineconeMatch } from '../types';

let pineconeClient: Pinecone | null = null;
let index: Index | null = null;

/**
 * Get Pinecone client instance.
 */
function getPineconeClient(): Pinecone {
  if (pineconeClient === null) {
    const apiKey = getEnv('PINECONE_API_KEY');
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

/**
 * Get Pinecone index instance.
 */
export function getIndex(): Index {
  if (index === null) {
    const pc = getPineconeClient();
    const indexName = getEnv('PINECONE_INDEX_NAME') || 'ai-memory';
    
    try {
      index = pc.index(indexName);
    } catch (error) {
      throw new Error(
        `Pinecone index '${indexName}' not found. Please create it first. Error: ${error}`
      );
    }
  }
  return index;
}

/**
 * Upsert an embedding into Pinecone.
 */
export async function upsertEmbedding(
  embeddingId: string,
  vector: number[],
  metadata: Record<string, any>
): Promise<void> {
  const idx = getIndex();
  
  await idx.upsert([
    {
      id: embeddingId,
      values: vector,
      metadata,
    },
  ]);
}

/**
 * Search for similar embeddings.
 */
export async function searchEmbeddings(
  queryVector: number[],
  topK: number = 10
): Promise<PineconeMatch[]> {
  const idx = getIndex();
  
  const results = await idx.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });
  
  // Convert to our match format
  const matches: PineconeMatch[] = (results.matches || []).map((match) => ({
    id: match.id,
    score: match.score || 0,
    metadata: (match.metadata as Record<string, any>) || {},
  }));
  
  return matches;
}

/**
 * Delete an embedding from Pinecone.
 */
export async function deleteEmbedding(embeddingId: string): Promise<void> {
  const idx = getIndex();
  await idx.deleteOne(embeddingId);
}

