/** API route for creating memories from PDF files. */
import { NextRequest, NextResponse } from 'next/server';
import { createMemory } from '@/app/lib/services/memory';
import { MemoryCreate } from '@/app/lib/types';
import { extractText, getDocumentProxy } from 'unpdf';

/**
 * POST /api/memories/from-pdf
 * Create a memory from PDF file.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Read PDF content
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Parse PDF using unpdf
    const pdf = await getDocumentProxy(uint8Array);
    const { text: textContent } = await extractText(pdf, { mergePages: true });
    
    if (!textContent || !textContent.trim()) {
      return NextResponse.json(
        { error: 'PDF contains no extractable text' },
        { status: 400 }
      );
    }
    
    // Create memory from extracted text
    const memoryCreate: MemoryCreate = {
      content: textContent.trim(),
      metadata: {
        source: 'pdf',
        filename: file.name,
      },
    };
    
    const memory = await createMemory(memoryCreate);
    
    return NextResponse.json(memory, { status: 201 });
  } catch (error) {
    console.error('Error creating memory from PDF:', error);
    return NextResponse.json(
      { error: 'Failed to create memory from PDF', details: String(error) },
      { status: 500 }
    );
  }
}

