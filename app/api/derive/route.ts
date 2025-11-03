/** API route for deriving insights from multiple memories. */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/services/mongodb';
import { createMemory } from '@/app/lib/services/memory';
import { createRelationship } from '@/app/lib/services/relationship';
import { deriveInsight } from '@/app/lib/services/llm';
import { MemoryCreate, RelationshipCreate, RelationshipType } from '@/app/lib/types';

/**
 * POST /api/derive
 * Create a derived memory from existing memories using LLM.
 */
export async function POST(request: NextRequest) {
  try {
    const memoryIds: string[] = await request.json();
    
    // Validate input
    if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
      return NextResponse.json(
        { error: 'Array of memory IDs is required' },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Verify all memories exist
    const memories = await db
      .collection('memories')
      .find({ _id: { $in: memoryIds } } as any)
      .toArray();
    
    if (memories.length !== memoryIds.length) {
      return NextResponse.json(
        { error: 'One or more memories not found' },
        { status: 404 }
      );
    }
    
    // Extract memory contents
    const memoryContents = memories.map((mem) => mem.content);
    
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
    
    const derivedMemory = await createMemory(memoryCreate);
    
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

