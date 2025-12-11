/** API route for creating relationships between memories. */
import { NextRequest, NextResponse } from 'next/server';
import { createRelationship } from '@/app/lib/services/relationship';
import { RelationshipCreate, RelationshipType } from '@/app/lib/types';

/**
 * POST /api/memories/:id/relationships
 * Create a relationship between two memories.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fromMemoryId } = await params;
    const body = await request.json();
    
    // Validate request body
    if (!body.to || typeof body.to !== 'string') {
      return NextResponse.json(
        { error: 'Destination memory ID (to) is required' },
        { status: 400 }
      );
    }
    
    if (!body.type || !Object.values(RelationshipType).includes(body.type)) {
      return NextResponse.json(
        { error: 'Valid relationship type is required (update, extend, derive, or related)' },
        { status: 400 }
      );
    }
    
    const relationshipCreate: RelationshipCreate = {
      to: body.to,
      type: body.type as RelationshipType,
      description: body.description || null,
    };
    
    const relationship = await createRelationship(fromMemoryId, relationshipCreate);
    
    return NextResponse.json(relationship, { status: 201 });
  } catch (error) {
    console.error('Error creating relationship:', error);
    return NextResponse.json(
      { error: 'Failed to create relationship', details: String(error) },
      { status: 500 }
    );
  }
}





