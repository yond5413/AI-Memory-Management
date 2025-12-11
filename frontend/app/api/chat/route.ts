import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';
import { createQueryEmbedding } from '@/app/lib/services/embeddings';
import { searchEmbeddings } from '@/app/lib/services/pinecone';
import { executeRead } from '@/app/lib/services/neo4j';
import { generateChatResponse, ChatMessage } from '@/app/lib/services/llm';
import { ensureUserNamespace, getUserLlmModel } from '@/app/lib/services/supabase';
import { Memory, MemoryStatus } from '@/app/lib/types';
import { normalizeDateTime } from '@/app/lib/utils';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (isErrorResponse(authResult)) {
      return authResult;
    }
    const { userId } = authResult;
    const { graphNamespace, pineconeNamespace } = await ensureUserNamespace(userId);
    const userLlmModel = await getUserLlmModel(userId);

    const body = await request.json();
    const { message, memoryEnabled, systemPrompt, history } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let context = "";
    let retrievedMemories: Memory[] = [];

    // 2. Retrieval (if enabled)
    if (memoryEnabled) {
      try {
        // a. Embed query
        const queryEmbedding = await createQueryEmbedding(message);

        // b. Search Pinecone
        const matches = await searchEmbeddings(queryEmbedding, 5, pineconeNamespace);
        
        if (matches.length > 0) {
          const memoryIds = matches.map(m => m.metadata.memory_id).filter(Boolean);

          // c. Expand/Fetch from Neo4j (Source of Truth)
          // Fetch the memories themselves plus any immediately connected memories
          if (memoryIds.length > 0) {
            const cypher = `
              MATCH (m:Memory)
              WHERE m.id IN $ids AND m.namespace = $namespace
              OPTIONAL MATCH (m)-[r]-(related:Memory)
              RETURN m, collect(related) as related_nodes
            `;

            const results = await executeRead(cypher, { 
              ids: memoryIds,
              namespace: graphNamespace
            });

            const uniqueMemories = new Map<string, any>();

            results.forEach(row => {
              const m = row.m.properties;
              uniqueMemories.set(m.id, m);
              
              // Add related memories if we want to expand context further
              // row.related_nodes.forEach((rel: any) => {
              //   const rm = rel.properties;
              //   uniqueMemories.set(rm.id, rm);
              // });
            });

            retrievedMemories = Array.from(uniqueMemories.values()).map(node => ({
              id: node.id,
              content: node.content,
              embedding_id: node.vector_id,
              status: node.status as MemoryStatus,
              supersedes: node.supersedes,
              superseded_by: node.superseded_by,
              entity_id: node.entity_id,
              metadata: typeof node.metadata === 'string' ? JSON.parse(node.metadata) : node.metadata,
              created_at: normalizeDateTime(node.created_at),
            }));

            // Sort by relevance (simplified: just use the search order for now, or recency)
            // Since we used a Map, order might be mixed, but Pinecone gave us relevance. 
            // We'll just construct context from all unique retrieved items.
            
            context = retrievedMemories
              .map(m => `[Memory ID: ${m.id}] ${m.content}`)
              .join("\n\n");
          }
        }
      } catch (error) {
        console.error("Retrieval pipeline failed:", error);
        // Continue without memory if retrieval fails
      }
    }

    // 3. Generate Response
    const systemContext = `
${systemPrompt}

${context ? `Context from memory:\n${context}` : "No relevant long-term memories found."}

Instructions:
- Answer the user's message based on the conversation history and the provided context.
- If the context contains relevant information, use it to inform your answer.
- If the context contradicts the user's current statement, politely note the discrepancy.
`;

    // Format history for LLM
    const chatMessages: ChatMessage[] = (history || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Add current user message
    chatMessages.push({ role: 'user', content: message });

    const response = await generateChatResponse(chatMessages, systemContext, userLlmModel);

    return NextResponse.json({
      response,
      retrievedMemories
    });

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

