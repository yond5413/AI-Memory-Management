/** API route for getting memory lineage. */
import { NextRequest, NextResponse } from 'next/server';
import { getMemory } from '@/app/lib/services/memory';
import { executeRead } from '@/app/lib/services/neo4j';
import { Memory, Relationship, LineageResponse, RelationshipType, MemoryStatus } from '@/app/lib/types';
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';
import { ensureUserNamespace } from '@/app/lib/services/supabase';
import { normalizeDateTime } from '@/app/lib/utils';

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
      created_at: any;
    };
  };
}

interface Neo4jRelationshipResult {
  r: {
    properties: {
      id: string;
      description: string | null;
      created_at: any;
    };
  };
  fromId: string;
  toId: string;
  type: string;
}

/**
 * GET /api/memories/:id/lineage
 * Get memory lineage (all related memories).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (isErrorResponse(authResult)) {
      return authResult;
    }
    const { userId } = authResult;
    
    // Get user's namespace
    const { graphNamespace } = await ensureUserNamespace(userId);
    
    const { id: memoryId } = await params;
    
    // Find memory
    const memory = await getMemory(memoryId, graphNamespace);
    
    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }
    
    // Find all relationships and related memories using graph traversal
    const cypher = `
      MATCH (m:Memory {id: $id, namespace: $namespace})
      OPTIONAL MATCH (m)-[r_out]->(other_out:Memory {namespace: $namespace})
      OPTIONAL MATCH (other_in:Memory {namespace: $namespace})-[r_in]->(m)
      WITH m,
        COLLECT(DISTINCT {r: r_out, fromId: m.id, toId: other_out.id, type: type(r_out)}) +
        COLLECT(DISTINCT {r: r_in, fromId: other_in.id, toId: m.id, type: type(r_in)}) as allRels,
        COLLECT(DISTINCT other_out) + COLLECT(DISTINCT other_in) as allMemories
      UNWIND allRels as rel
      WITH m, rel, allMemories
      WHERE rel.r IS NOT NULL
      WITH COLLECT(DISTINCT {r: rel.r, fromId: rel.fromId, toId: rel.toId, type: rel.type}) as relationships, allMemories
      UNWIND allMemories as mem
      WITH relationships, COLLECT(DISTINCT mem) as memories
      RETURN relationships, memories
    `;
    
    const results = await executeRead<{
      relationships: Neo4jRelationshipResult[];
      memories: Array<{ properties: Neo4jMemoryNode['m']['properties'] }>;
    }>(cypher, { id: memoryId, namespace: graphNamespace });
    
    let relationships: Relationship[] = [];
    let relatedMemories: Memory[] = [];
    
    if (results.length > 0 && results[0].relationships) {
      relationships = results[0].relationships
        .filter((rel) => rel && rel.r)
        .map((rel) => ({
          id: rel.r.properties.id,
          from_memory: rel.fromId,
          to_memory: rel.toId,
          type: rel.type.toLowerCase() as RelationshipType,
          description: rel.r.properties.description,
          created_at: normalizeDateTime(rel.r.properties.created_at),
        }));

      relatedMemories = results[0].memories
        .filter((mem) => mem && mem.properties)
        .map((mem) => ({
          id: mem.properties.id,
          content: mem.properties.content,
          embedding_id: mem.properties.vector_id,
          status: mem.properties.status as MemoryStatus,
          supersedes: mem.properties.supersedes,
          superseded_by: mem.properties.superseded_by,
          entity_id: mem.properties.entity_id,
          metadata: JSON.parse(mem.properties.metadata),
          created_at: normalizeDateTime(mem.properties.created_at),
        }));
    }
    
    const response: LineageResponse = {
      memory,
      relationships,
      related_memories: relatedMemories,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting memory lineage:', error);
    return NextResponse.json(
      { error: 'Failed to get memory lineage', details: String(error) },
      { status: 500 }
    );
  }
}

