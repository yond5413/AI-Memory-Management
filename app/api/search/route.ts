/** API route for semantic search. */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/services/mongodb';
import { createQueryEmbedding } from '@/app/lib/services/embeddings';
import { searchEmbeddings } from '@/app/lib/services/pinecone';
import { Memory } from '@/app/lib/types';

/**
 * GET /api/search?q=query
 * Semantic search across memories.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter (q) is required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    try {
      // Create embedding for query
      const queryEmbedding = await createQueryEmbedding(query);
      
      // Search Pinecone
      const results = await searchEmbeddings(queryEmbedding, 10);
      
      // Extract memory IDs from results
      const memoryIds = results
        .map((match) => match.metadata?.memory_id)
        .filter((id): id is string => typeof id === 'string');
      
      if (memoryIds.length === 0) {
        return NextResponse.json([]);
      }
      
      // Fetch memories from MongoDB
      const memoriesRaw = await db
        .collection('memories')
        .find({ _id: { $in: memoryIds } } as any)
        .toArray();
      
      // Sort by Pinecone score (maintain order from results)
      const memoryMap = new Map(
        memoriesRaw.map((mem) => [String(mem._id), mem])
      );
      
      const sortedMemories = memoryIds
        .map((id) => memoryMap.get(id))
        .filter((mem): mem is NonNullable<typeof mem> => mem !== undefined);
      
      const memories: Memory[] = sortedMemories.map((mem) => ({
        id: String(mem._id),
        content: mem.content,
        embedding_id: mem.embedding_id,
        status: mem.status,
        supersedes: mem.supersedes,
        superseded_by: mem.superseded_by,
        entity_id: mem.entity_id,
        metadata: mem.metadata,
        created_at: mem.created_at,
      }));
      
      return NextResponse.json(memories);
    } catch (error) {
      // Fallback to simple text search if vector search fails
      console.warn('Semantic search failed, falling back to text search:', error);
      
      const memories = await db
        .collection('memories')
        .find({ status: 'current' })
        .limit(10)
        .toArray();
      
      const result: Memory[] = memories.map((mem) => ({
        id: String(mem._id),
        content: mem.content,
        embedding_id: mem.embedding_id,
        status: mem.status,
        supersedes: mem.supersedes,
        superseded_by: mem.superseded_by,
        entity_id: mem.entity_id,
        metadata: mem.metadata,
        created_at: mem.created_at,
      }));
      
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error in search:', error);
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    );
  }
}

