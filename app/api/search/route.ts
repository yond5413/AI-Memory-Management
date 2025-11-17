/** API route for semantic search. */
import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/app/lib/services/neo4j';
import { createQueryEmbedding } from '@/app/lib/services/embeddings';
import { searchEmbeddings } from '@/app/lib/services/pinecone';
import { Memory, MemoryStatus } from '@/app/lib/types';
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';
import { ensureUserNamespace } from '@/app/lib/services/supabase';

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
    };
  };
}

/**
 * GET /api/search?q=query
 * Semantic search across memories.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (isErrorResponse(authResult)) {
      return authResult;
    }
    const { userId } = authResult;
    
    // Get user's namespace
    const { graphNamespace, pineconeNamespace } = await ensureUserNamespace(userId);
    
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter (q) is required' },
        { status: 400 }
      );
    }
    
    try {
      // Create embedding for query
      const queryEmbedding = await createQueryEmbedding(query);
      
      // Search Pinecone with user's namespace
      const results = await searchEmbeddings(queryEmbedding, 10, pineconeNamespace);
      
      // Extract memory IDs from results
      const memoryIds = results
        .map((match) => match.metadata?.memory_id)
        .filter((id): id is string => typeof id === 'string');
      
      if (memoryIds.length === 0) {
        return NextResponse.json([]);
      }
      
      // Fetch memories from Neo4j with namespace filtering
      const cypher = `
        MATCH (m:Memory {namespace: $namespace})
        WHERE m.id IN $memoryIds
        RETURN m
      `;
      
      const memoriesResults = await executeRead<Neo4jMemoryNode>(cypher, { 
        memoryIds,
        namespace: graphNamespace,
      });
      
      // Create a map for quick lookup
      const memoryMap = new Map(
        memoriesResults.map((result) => [result.m.properties.id, result.m.properties])
      );
      
      // Sort by Pinecone score (maintain order from results)
      const sortedMemories = memoryIds
        .map((id) => memoryMap.get(id))
        .filter((mem): mem is NonNullable<typeof mem> => mem !== undefined);
      
      const memories: Memory[] = sortedMemories.map((mem) => ({
        id: mem.id,
        content: mem.content,
        embedding_id: mem.vector_id,
        status: mem.status as MemoryStatus,
        supersedes: mem.supersedes,
        superseded_by: mem.superseded_by,
        entity_id: mem.entity_id,
        metadata: JSON.parse(mem.metadata),
        created_at: mem.created_at,
      }));
      
      return NextResponse.json(memories);
    } catch (error) {
      // Fallback to simple query if vector search fails
      console.warn('Semantic search failed, falling back to current memories:', error);
      
      const cypher = `
        MATCH (m:Memory {status: $status, namespace: $namespace})
        RETURN m
        ORDER BY m.created_at DESC
        LIMIT 10
      `;
      
      const results = await executeRead<Neo4jMemoryNode>(cypher, { 
        status: MemoryStatus.CURRENT,
        namespace: graphNamespace,
      });
      
      const memories: Memory[] = results.map((result) => {
        const mem = result.m.properties;
        return {
          id: mem.id,
          content: mem.content,
          embedding_id: mem.vector_id,
          status: mem.status as MemoryStatus,
          supersedes: mem.supersedes,
          superseded_by: mem.superseded_by,
          entity_id: mem.entity_id,
          metadata: JSON.parse(mem.metadata),
          created_at: mem.created_at,
        };
      });
      
      return NextResponse.json(memories);
    }
  } catch (error) {
    console.error('Error in search:', error);
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    );
  }
}

