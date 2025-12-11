/** API route for getting a memory by ID. */
import { NextRequest, NextResponse } from 'next/server';
import { getMemory, deleteMemory } from '@/app/lib/services/memory';
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';
import { ensureUserNamespace } from '@/app/lib/services/supabase';

/**
 * GET /api/memories/:id
 * Get a memory by ID.
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
    
    const { id } = await params;
    
    const memory = await getMemory(id, graphNamespace);
    
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

/**
 * DELETE /api/memories/:id
 * Delete a memory by ID.
 */
export async function DELETE(
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
    
    const { id } = await params;
    
    // Check if memory exists and belongs to user (via namespace)
    const memory = await getMemory(id, graphNamespace);
    
    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }
    
    await deleteMemory(id, graphNamespace);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting memory:', error);
    return NextResponse.json(
      { error: 'Failed to delete memory', details: String(error) },
      { status: 500 }
    );
  }
}
