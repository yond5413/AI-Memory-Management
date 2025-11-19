/** API route for creating memories from PDF files. */
import { NextRequest, NextResponse } from 'next/server';
import { createMemory } from '@/app/lib/services/memory';
import { MemoryCreate, Memory } from '@/app/lib/types';
import { extractText, getDocumentProxy } from 'unpdf';
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';
import { ensureUserNamespace, getUserLlmModel } from '@/app/lib/services/supabase';
import { analyzePdfStructure, extractKeyPoints } from '@/app/lib/services/llm';

/**
 * POST /api/memories/from-pdf
 * Create memories from PDF file, chunking by paragraphs.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (isErrorResponse(authResult)) {
      return authResult;
    }
    const { userId } = authResult;
    
    // Get user's namespace and LLM model preference
    const { graphNamespace } = await ensureUserNamespace(userId);
    const userLlmModel = await getUserLlmModel(userId);
    
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
    
    // Intelligent Chunking Strategy:
    // Use LLM to analyze document structure and identify semantic boundaries
    console.log('Analyzing PDF structure for intelligent chunking with model:', userLlmModel);
    const chunks = await analyzePdfStructure(textContent, userLlmModel);
    
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Failed to process PDF content' },
        { status: 500 }
      );
    }
    
    console.log(`Identified ${chunks.length} semantic sections in PDF`);

    const createdMemories: Memory[] = [];

    // Create memories for each semantic chunk
    // We do this sequentially to avoid overwhelming the DB/Embedding API with parallel requests
    for (const [index, chunk] of chunks.entries()) {
        // Extract key points from the chunk
        let keyPoints = chunk.text;
        try {
            console.log(`Extracting key points for section: ${chunk.topic}`);
            keyPoints = await extractKeyPoints(chunk.text, chunk.topic, userLlmModel);
        } catch (e) {
             console.warn(`Failed to extract key points for chunk ${index}, using original text`, e);
             // Fallback to truncated original text
             keyPoints = chunk.text.substring(0, 500);
        }

        const memoryCreate: MemoryCreate = {
            content: keyPoints,
            metadata: {
                source: 'pdf',
                filename: file.name,
                chunk_index: index,
                total_chunks: chunks.length,
                section_topic: chunk.topic,
                original_text: chunk.text, // Store full original text
                char_range: `${chunk.startIndex}-${chunk.endIndex}`
            },
        };
        
        try {
            const memory = await createMemory(memoryCreate, userId, graphNamespace);
            createdMemories.push(memory);
            console.log(`Created memory for section: ${chunk.topic}`);
        } catch (e) {
            console.error(`Failed to create memory for chunk ${index}`, e);
            // Continue with other chunks
        }
    }
    
    return NextResponse.json(createdMemories, { status: 201 });
  } catch (error) {
    console.error('Error creating memory from PDF:', error);
    return NextResponse.json(
      { error: 'Failed to create memory from PDF', details: String(error) },
      { status: 500 }
    );
  }
}
