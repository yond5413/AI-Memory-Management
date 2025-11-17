/** API route for deriving insights from multiple memories. */
import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/app/lib/services/neo4j';
import { createMemory } from '@/app/lib/services/memory';
import { createRelationship } from '@/app/lib/services/relationship';
import { deriveInsight } from '@/app/lib/services/llm';
import { MemoryCreate, RelationshipCreate, RelationshipType, MemoryStatus } from '@/app/lib/types';
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
 * POST /api/derive
 * Create a derived memory from existing memories using LLM.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (isErrorResponse(authResult)) {
      return authResult;
    }
    const { userId } = authResult;
    
    // Get user's namespace
    const { graphNamespace } = await ensureUserNamespace(userId);
    
    const memoryIds: string[] = await request.json();
    
    // Validate input
    if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
      return NextResponse.json(
        { error: 'Array of memory IDs is required' },
        { status: 400 }
      );
    }
    
    // Verify all memories exist and belong to user
    const cypher = `
      MATCH (m:Memory {namespace: $namespace})
      WHERE m.id IN $memoryIds
      RETURN m
    `;
    
    const results = await executeRead<Neo4jMemoryNode>(cypher, { 
      memoryIds,
      namespace: graphNamespace,
    });
    
    if (results.length !== memoryIds.length) {
      return NextResponse.json(
        { error: 'One or more memories not found' },
        { status: 404 }
      );
    }
    
    // Extract memory contents
    const memoryContents = results.map((result) => result.m.properties.content);
    
    // Derive insight using LLM
    const derivedContent = await deriveInsight(memoryContents);
    
    // Create derived memory
    const memoryCreate: MemoryCreate = {
      content: derivedContent,
      metadata: {
        source: 'derived',
        based_on: memoryIds,
      },
    };
    
    const derivedMemory = await createMemory(memoryCreate, userId, graphNamespace);
    
    // Create derive relationships
    for (const memoryId of memoryIds) {
      const relationship: RelationshipCreate = {
        to: derivedMemory.id,
        type: RelationshipType.DERIVE,
        description: `Derived from memory ${memoryId}`,
      };
      
      await createRelationship(memoryId, relationship);
    }
    
    return NextResponse.json(derivedMemory, { status: 201 });
  } catch (error) {
    console.error('Error deriving memory:', error);
    return NextResponse.json(
      { error: 'Failed to derive memory', details: String(error) },
      { status: 500 }
    );
  }
}

