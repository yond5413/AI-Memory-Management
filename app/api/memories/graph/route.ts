/** API route for getting all memories and relationships for graph visualization. */
import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/app/lib/services/neo4j';
import { Memory, Relationship, RelationshipType, MemoryStatus } from '@/app/lib/types';
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';
import { ensureUserNamespace } from '@/app/lib/services/supabase';

export interface GraphResponse {
  memories: Memory[];
  relationships: Relationship[];
}

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

interface Neo4jRelationshipResult {
  r: {
    properties: {
      id: string;
      description: string | null;
      created_at: string;
    };
  };
  fromId: string;
  toId: string;
  type: string;
}

/**
 * GET /api/memories/graph
 * Get all memories and relationships for network graph visualization.
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
    const { graphNamespace } = await ensureUserNamespace(userId);
    
    // Fetch all memories for user's namespace
    const memoriesCypher = `
      MATCH (m:Memory {namespace: $namespace})
      RETURN m
      ORDER BY m.created_at DESC
    `;
    
    const memoriesResults = await executeRead<Neo4jMemoryNode>(memoriesCypher, {
      namespace: graphNamespace,
    });
    
    const memories: Memory[] = memoriesResults.map((result) => {
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
    
    // Fetch all relationships for user's namespace
    const relationshipsCypher = `
      MATCH (from:Memory {namespace: $namespace})-[r]->(to:Memory {namespace: $namespace})
      RETURN r, from.id as fromId, to.id as toId, type(r) as type
    `;
    
    const relationshipsResults = await executeRead<Neo4jRelationshipResult>(relationshipsCypher, {
      namespace: graphNamespace,
    });
    
    const relationships: Relationship[] = relationshipsResults.map((result) => ({
      id: result.r.properties.id,
      from_memory: result.fromId,
      to_memory: result.toId,
      type: result.type.toLowerCase() as RelationshipType,
      description: result.r.properties.description,
      created_at: result.r.properties.created_at,
    }));
    
    const response: GraphResponse = {
      memories,
      relationships,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting graph data:', error);
    return NextResponse.json(
      { error: 'Failed to get graph data', details: String(error) },
      { status: 500 }
    );
  }
}

