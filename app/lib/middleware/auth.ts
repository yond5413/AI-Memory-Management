/** Authentication middleware for API routes. */
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../services/supabase';

export interface AuthenticatedRequest {
  userId: string;
}

/**
 * Middleware to protect API routes with authentication.
 * Returns the user ID if authenticated, otherwise returns an error response.
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  
  const userId = await getUserIdFromRequest(authHeader);
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in.' },
      { status: 401 }
    );
  }
  
  return { userId };
}

/**
 * Helper to check if a result is an error response.
 */
export function isErrorResponse(
  result: { userId: string } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

