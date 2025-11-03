/** API route for getting all memories and relationships for graph visualization. */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/services/mongodb';
import { Memory, Relationship } from '@/app/lib/types';

export interface GraphResponse {
  memories: Memory[];
  relationships: Relationship[];
}

/**
 * GET /api/memories/graph
 * Get all memories and relationships for network graph visualization.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    
    // Fetch all memories
    const memoriesRaw = await db
      .collection('memories')
      .find({})
      .toArray();
    
    // Fetch all relationships
    const relationshipsRaw = await db
      .collection('relationships')
      .find({})
      .toArray();
    
    // Convert to response format
    const memories: Memory[] = memoriesRaw.map((mem) => ({
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
    
    const relationships: Relationship[] = relationshipsRaw.map((rel) => ({
      id: String(rel._id),
      from_memory: rel.from_memory,
      to_memory: rel.to_memory,
      type: rel.type,
      description: rel.description,
      created_at: rel.created_at,
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

