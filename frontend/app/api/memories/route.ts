/** API route for creating memories. */
import { NextRequest, NextResponse } from 'next/server';
import { createMemory } from '@/app/lib/services/memory';
import { MemoryCreate } from '@/app/lib/types';
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';
import { ensureUserNamespace } from '@/app/lib/services/supabase';

/**
 * POST /api/memories
 * Create a new memory from text.
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
    
    const memory = await createMemory(memoryCreate, userId, graphNamespace);
    
    return NextResponse.json(memory, { status: 201 });
  } catch (error) {
    console.error('Error creating memory:', error);
    return NextResponse.json(
      { error: 'Failed to create memory', details: String(error) },
      { status: 500 }
    );
  }
}


