/** Embedding service using Cohere. */
import { CohereClient } from 'cohere-ai';
import { getEnv } from '../utils';

let cohereClient: CohereClient | null = null;

/**
 * Get Cohere client instance.
 */
function getCohereClient(): CohereClient {
  if (cohereClient === null) {
    const apiKey = getEnv('COHERE_API_KEY');
    if (!apiKey) {
      throw new Error('COHERE_API_KEY environment variable is required');
    }
    cohereClient = new CohereClient({ token: apiKey });
  }
  return cohereClient;
}

/**
 * Create an embedding for the given text.
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const client = getCohereClient();
  
  const response = await client.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });
  
  return (response.embeddings as number[][])[0];
}

/**
 * Create embeddings for multiple texts.
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getCohereClient();
  
  const response = await client.embed({
    texts,
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });
  
  return response.embeddings as number[][];
}

/**
 * Create a query embedding (uses different input type for search queries).
 */
export async function createQueryEmbedding(text: string): Promise<number[]> {
  const client = getCohereClient();
  
  const response = await client.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });
  
  return (response.embeddings as number[][])[0];
}

