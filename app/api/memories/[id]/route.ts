/** API route for getting a memory by ID. */
import { NextRequest, NextResponse } from 'next/server';
import { getMemory } from '@/app/lib/services/memory';

/**
 * GET /api/memories/:id
 * Get a memory by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const memory = await getMemory(id);
    
    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(memory);
  } catch (error) {
    console.error('Error getting memory:', error);
    return NextResponse.json(
      { error: 'Failed to get memory', details: String(error) },
      { status: 500 }
    );
  }
}

