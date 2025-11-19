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

    interface ProcessResult {
      successful: { memory: Memory; chunkIndex: number }[];
      failed: { error: string; chunkIndex: number; chunkTopic: string }[];
    }

    const results: ProcessResult = {
      successful: [],
      failed: []
    };

    // Create memories for each semantic chunk
    // We do this sequentially to avoid overwhelming the DB/Embedding API with parallel requests
    for (const [index, chunk] of chunks.entries()) {
        console.log(`\n--- Processing chunk ${index + 1}/${chunks.length} ---`);
        console.log(`Section: ${chunk.topic}`);
        console.log(`Original text length: ${chunk.text.length} chars`);
        
        try {
          // Extract key points from the chunk with retry logic
          const keyPoints = await extractKeyPoints(chunk.text, chunk.topic, userLlmModel);
          console.log(`✓ Summarized to: ${keyPoints.length} chars`);
          console.log(`Summary preview: ${keyPoints.substring(0, 150)}...`);

          const memoryCreate: MemoryCreate = {
              content: keyPoints, // Store the summary
              metadata: {
                  source: 'pdf',
                  filename: file.name,
                  chunk_index: index,
                  total_chunks: chunks.length,
                  section_topic: chunk.topic,
                  original_text: chunk.text, // Store full original text in metadata
                  char_range: `${chunk.startIndex}-${chunk.endIndex}`,
                  summary_length: keyPoints.length,
                  original_length: chunk.text.length
              },
          };
          
          const memory = await createMemory(memoryCreate, userId, graphNamespace);
          results.successful.push({ memory, chunkIndex: index });
          console.log(`✓ Created memory ${memory.id} for section: ${chunk.topic}`);
        } catch (e) {
            console.error(`✗ Failed to process chunk ${index} (${chunk.topic}):`, e);
            results.failed.push({
              error: String(e),
              chunkIndex: index,
              chunkTopic: chunk.topic
            });
        }
    }
    
    const successCount = results.successful.length;
    const failedCount = results.failed.length;
    
    console.log(`\n=== PDF Processing Complete ===`);
    console.log(`✓ Successful: ${successCount} chunks`);
    console.log(`✗ Failed: ${failedCount} chunks`);
    
    // Determine response based on results
    if (successCount === 0) {
        // Complete failure - no memories created
        console.error('Complete failure: No PDF chunks were successfully processed');
        return NextResponse.json(
            { 
                error: 'Failed to process any PDF chunks',
                details: results.failed.map(f => `${f.chunkTopic}: ${f.error}`).join('; '),
                failed_chunks: results.failed,
                hint: 'Check your OPENROUTER_API_KEY configuration'
            },
            { status: 500 }
        );
    } else if (failedCount === 0) {
        // Complete success - all memories created
        const createdMemories = results.successful.map(r => r.memory);
        return NextResponse.json(createdMemories, { status: 201 });
    } else {
        // Partial success - some memories created, some failed
        console.warn(`⚠ Partial success: ${failedCount} chunks failed processing`);
        const createdMemories = results.successful.map(r => r.memory);

        // Return partial success response
        return NextResponse.json({
            memories: createdMemories,
            success: true,
            partial: true,
            message: `Successfully processed ${successCount} of ${chunks.length} chunks`,
            failed_chunks: results.failed,
            warning: `${failedCount} chunks failed processing and were skipped`
        }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating memory from PDF:', error);
    return NextResponse.json(
      { error: 'Failed to create memory from PDF', details: String(error) },
      { status: 500 }
    );
  }
}
