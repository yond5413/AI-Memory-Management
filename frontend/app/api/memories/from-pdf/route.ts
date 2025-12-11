/** API route for creating memories from PDF files. */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';

/**
 * POST /api/memories/from-pdf
 * Forward PDF upload to FastAPI backend.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (isErrorResponse(authResult)) {
      return authResult;
    }
    const { userId } = authResult;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Create new FormData for the backend request
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('user_id', userId);

    // Call FastAPI Backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    try {
      const response = await fetch(`${backendUrl}/memories/process-pdf`, {
        method: 'POST',
        body: backendFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FastAPI Backend Error:', errorText);
        return NextResponse.json(
          { error: 'Backend processing failed', details: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: 200 });

    } catch (fetchError) {
      console.error('Failed to connect to backend:', fetchError);
      return NextResponse.json(
        { error: 'Backend unavailable. Please ensure the Python server is running.', details: String(fetchError) },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Error in PDF proxy:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: 500 }
    );
  }
}
