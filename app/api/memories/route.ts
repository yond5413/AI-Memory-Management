/** API route for creating memories. */
import { NextRequest, NextResponse } from 'next/server';
import { createMemory } from '@/app/lib/services/memory';
import { MemoryCreate } from '@/app/lib/types';

/**
 * POST /api/memories
 * Create a new memory from text.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }
    
    const memoryCreate: MemoryCreate = {
      content: body.content,
      metadata: body.metadata || {},
    };
    
    const memory = await createMemory(memoryCreate);
    
    return NextResponse.json(memory, { status: 201 });
  } catch (error) {
    console.error('Error creating memory:', error);
    return NextResponse.json(
      { error: 'Failed to create memory', details: String(error) },
      { status: 500 }
    );
  }
}

