/** API route for getting memory lineage. */
import { NextRequest, NextResponse } from 'next/server';
import { getMemory } from '@/app/lib/services/memory';
import { getDb } from '@/app/lib/services/mongodb';
import { Memory, Relationship, LineageResponse } from '@/app/lib/types';

/**
 * GET /api/memories/:id/lineage
 * Get memory lineage (all related memories).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memoryId } = await params;
    const db = getDb();
    
    // Find memory
    const memory = await getMemory(memoryId);
    
    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }
    
    // Find all relationships involving this memory
    const relationshipsRaw = await db
      .collection('relationships')
      .find({
        $or: [{ from_memory: memoryId }, { to_memory: memoryId }],
      })
      .toArray();
    
    // Get all related memory IDs
    const relatedIds = new Set<string>();
    relationshipsRaw.forEach((rel) => {
      relatedIds.add(rel.from_memory);
      relatedIds.add(rel.to_memory);
    });
    
    // Fetch all related memories
    const relatedMemoriesRaw = await db
      .collection('memories')
      .find({ _id: { $in: Array.from(relatedIds) } } as any)
      .toArray();
    
    // Convert to response format
    const relatedMemories: Memory[] = relatedMemoriesRaw.map((mem) => ({
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

