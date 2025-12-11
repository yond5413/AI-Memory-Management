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
  metadata: Record<string, any>,
  namespace?: string
): Promise<void> {
  const idx = getIndex();

  const ns = namespace ? idx.namespace(namespace) : idx;

  await ns.upsert([
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
  topK: number = 10,
  namespace?: string
): Promise<PineconeMatch[]> {
  const idx = getIndex();

  const ns = namespace ? idx.namespace(namespace) : idx;

  const results = await ns.query({
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
export async function deleteEmbedding(
  embeddingId: string,
  namespace?: string
): Promise<void> {
  const idx = getIndex();
  const ns = namespace ? idx.namespace(namespace) : idx;
  await ns.deleteOne(embeddingId);
}
/**
 * Fetch vectors for clustering.
 * Note: Initial implementation fetches top 1000 vectors via dummy query.
 * For production with >10k items, this needs a different strategy (Fetch by ID list from DB).
 */
export async function getVectorsForClustering(
  namespace: string
): Promise<{ id: string; values: number[] }[]> {
  const idx = getIndex();
  const ns = idx.namespace(namespace);

  // Hack to get "all" vectors: query with a zero vector
  // This will return results based on vector math (likely random or near zero)
  // But we just want the valid vectors.
  // Better approach: Get list of IDs from Supabase 'memories' table, then valid Pinecone Fetch.
  // But for now, let's assume we want to cluster the most recent or relevant 1000.
  const dummyVector = new Array(1536).fill(0.01);

  const results = await ns.query({
    vector: dummyVector,
    topK: 2000,
    includeValues: true,
    includeMetadata: false
  });

  return (results.matches || []).map(m => ({
    id: m.id,
    values: m.values || []
  }));
}

