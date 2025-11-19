/** LLM service for deriving insights using OpenRouter. */
import OpenAI from 'openai';
import { getEnv } from '../utils';

let openaiClient: OpenAI | null = null;

/**
 * Get OpenAI client configured for OpenRouter.
 */
function getOpenAIClient(): OpenAI {
  if (openaiClient === null) {
    const apiKey = getEnv('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
    
    openaiClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    });
  }
  return openaiClient;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Generate a chat response using the LLM.
 */
export async function generateChatResponse(
  messages: ChatMessage[], 
  systemPrompt?: string,
  model: string = 'qwen/qwen3-235b-a22b:free'
): Promise<string> {
  const client = getOpenAIClient();
  
  const chatMessages = [...messages];
  
  // Prepend system prompt if provided
  if (systemPrompt) {
    chatMessages.unshift({ role: 'system', content: systemPrompt });
  }

  try {
    const response = await client.chat.completions.create({
      model,
      messages: chatMessages,
      temperature: 0.7,
    });
    
    return response.choices[0]?.message?.content?.trim() || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error('LLM chat generation failed:', error);
    return "I encountered an error while generating a response. Please try again.";
  }
}

/**
 * Derive an insight from multiple memories using LLM.
 */
export async function deriveInsight(memoryContents: string[]): Promise<string> {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  
  // Fallback to simple concatenation if no API key
  if (!apiKey) {
    return `Derived insight from ${memoryContents.length} memories: ${memoryContents.join(' ').substring(0, 500)}`;
  }
  
  const client = getOpenAIClient();
  
  // Combine memories as context
  const context = memoryContents
    .map((content, i) => `Memory ${i + 1}: ${content}`)
    .join('\n\n');
  
  // Create prompt for derivation
  const prompt = `Based on the following memories, derive a new insight or conclusion:

${context}

Please provide a concise derived insight that synthesizes information from these memories:`;
  
  try {
    const response = await client.chat.completions.create({
      model: 'qwen/qwen3-235b-a22b:free',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that derives insights from memories.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
    });
    
    return response.choices[0]?.message?.content?.trim() || 
      `Derived insight from ${memoryContents.length} memories`;
  } catch (error) {
    console.error('LLM derivation failed:', error);
    // Fallback on error
    return `Derived insight from ${memoryContents.length} memories: ${memoryContents.join(' ').substring(0, 500)}`;
  }
}

/**
 * Generate a summary of a memory.
 */
export async function summarizeMemory(content: string): Promise<string> {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  
  // Fallback if no API key
  if (!apiKey) {
    return content.substring(0, 200);
  }
  
  const client = getOpenAIClient();
  
  try {
    const response = await client.chat.completions.create({
      model: 'minimax/minimax-m2:free',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes text concisely.',
        },
        {
          role: 'user',
          content: `Summarize this text in one concise sentence:\n\n${content}`,
        },
      ],
      max_tokens: 100,
    });
    
    return response.choices[0]?.message?.content?.trim() || content.substring(0, 200);
  } catch (error) {
    console.error('LLM summarization failed:', error);
    return content.substring(0, 200);
  }
}

/**
 * PDF chunk representing a semantic section of text.
 */
export interface PdfChunk {
  startIndex: number;
  endIndex: number;
  topic: string;
  text: string;
}

/**
 * Analyze PDF structure and identify semantic boundaries.
 * Uses LLM to determine logical sections and topics.
 */
export async function analyzePdfStructure(
  fullText: string,
  model: string = 'qwen/qwen3-235b-a22b:free'
): Promise<PdfChunk[]> {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  
  // Fallback: simple paragraph-based chunking if no API key
  if (!apiKey) {
    return simpleFallbackChunking(fullText);
  }
  
  const client = getOpenAIClient();
  
  // Truncate very long documents for initial analysis
  const analysisText = fullText.length > 15000 
    ? fullText.substring(0, 15000) + '\n\n[... document continues ...]'
    : fullText;
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a document analyzer that identifies semantic boundaries and topics in text. You return structured JSON responses.',
        },
        {
          role: 'user',
          content: `Analyze this document and identify 3-8 logical sections or topics. For each section, provide:
1. A brief topic/title (2-5 words)
2. Approximately where it starts (character position or "beginning", "middle", "end")
3. Approximately where it ends

Return your analysis as a JSON array with this structure:
[
  {"topic": "Introduction to topic", "position": "beginning"},
  {"topic": "Main concept discussion", "position": "middle"},
  {"topic": "Conclusion and summary", "position": "end"}
]

Document:
${analysisText}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });
    
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return simpleFallbackChunking(fullText);
    }
    
    // Parse JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('Could not parse LLM structure analysis, using fallback');
      return simpleFallbackChunking(fullText);
    }
    
    const sections = JSON.parse(jsonMatch[0]);
    
    // Convert position-based sections into actual text chunks
    return createChunksFromAnalysis(fullText, sections);
  } catch (error) {
    console.error('LLM PDF structure analysis failed:', error);
    return simpleFallbackChunking(fullText);
  }
}

/**
 * Convert LLM analysis into actual text chunks with boundaries.
 */
function createChunksFromAnalysis(fullText: string, sections: any[]): PdfChunk[] {
  const chunks: PdfChunk[] = [];
  const textLength = fullText.length;
  const numSections = sections.length;
  
  // Calculate approximate boundaries
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    let startIndex: number;
    let endIndex: number;
    
    // Estimate position based on hints
    if (section.position === 'beginning' || i === 0) {
      startIndex = 0;
      endIndex = Math.floor(textLength / numSections);
    } else if (section.position === 'end' || i === sections.length - 1) {
      startIndex = chunks[chunks.length - 1]?.endIndex || Math.floor(textLength * 0.7);
      endIndex = textLength;
    } else {
      startIndex = chunks[chunks.length - 1]?.endIndex || Math.floor((textLength / numSections) * i);
      endIndex = Math.floor((textLength / numSections) * (i + 1));
    }
    
    // Find nearest paragraph boundary
    startIndex = findParagraphBoundary(fullText, startIndex, 'start');
    endIndex = findParagraphBoundary(fullText, endIndex, 'end');
    
    // Ensure we don't exceed size limits (roughly 2000 tokens = ~8000 chars)
    const maxChunkSize = 8000;
    if (endIndex - startIndex > maxChunkSize) {
      endIndex = startIndex + maxChunkSize;
      endIndex = findParagraphBoundary(fullText, endIndex, 'end');
    }
    
    const text = fullText.substring(startIndex, endIndex).trim();
    
    if (text.length > 100) {
      chunks.push({
        startIndex,
        endIndex,
        topic: section.topic || `Section ${i + 1}`,
        text,
      });
    }
  }
  
  return chunks;
}

/**
 * Find the nearest paragraph boundary (double newline).
 */
function findParagraphBoundary(text: string, position: number, direction: 'start' | 'end'): number {
  const searchRadius = 200;
  
  if (direction === 'start') {
    const searchStart = Math.max(0, position - searchRadius);
    const substring = text.substring(searchStart, position + searchRadius);
    const match = substring.lastIndexOf('\n\n');
    if (match !== -1) {
      return searchStart + match + 2;
    }
  } else {
    const searchEnd = Math.min(text.length, position + searchRadius);
    const substring = text.substring(position - searchRadius, searchEnd);
    const match = substring.indexOf('\n\n');
    if (match !== -1) {
      return position - searchRadius + match;
    }
  }
  
  return position;
}

/**
 * Simple fallback chunking when LLM is unavailable.
 */
function simpleFallbackChunking(fullText: string): PdfChunk[] {
  const maxChunkSize = 6000;
  const chunks: PdfChunk[] = [];
  
  // Split by paragraphs first
  const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  
  let currentChunk = '';
  let currentStart = 0;
  let chunkIndex = 0;
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        startIndex: currentStart,
        endIndex: currentStart + currentChunk.length,
        topic: `Section ${chunkIndex + 1}`,
        text: currentChunk.trim(),
      });
      currentChunk = para + '\n\n';
      currentStart = currentStart + currentChunk.length;
      chunkIndex++;
    } else {
      currentChunk += para + '\n\n';
    }
  }
  
  // Add remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      startIndex: currentStart,
      endIndex: currentStart + currentChunk.length,
      topic: `Section ${chunkIndex + 1}`,
      text: currentChunk.trim(),
    });
  }
  
  return chunks.length > 0 ? chunks : [{
    startIndex: 0,
    endIndex: fullText.length,
    topic: 'Full Document',
    text: fullText,
  }];
}

/**
 * Extract key points from a text chunk for memory creation.
 * Returns a concise 1-2 sentence summary.
 */
export async function extractKeyPoints(
  content: string,
  topic?: string,
  model: string = 'qwen/qwen3-235b-a22b:free'
): Promise<string> {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  
  // Fallback if no API key
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not found - cannot summarize PDF chunks');
    throw new Error('OPENROUTER_API_KEY is required for PDF summarization');
  }
  
  const client = getOpenAIClient();
  
  // Retry logic with model fallbacks
  const fallbackModels = [
    model, // User's preferred model
    'qwen/qwen3-235b-a22b:free', // Reliable fallback
    'minimax/minimax-m2:free' // Secondary fallback
  ];
  
  let lastError: Error | null = null;
  
  for (const currentModel of fallbackModels) {
    try {
      const topicContext = topic ? ` about "${topic}"` : '';
      
      const response = await client.chat.completions.create({
        model: currentModel,
        messages: [
          {
            role: 'system',
            content: 'You are a precise summarization expert. Create concise summaries that capture essential information in 1-2 complete sentences.',
          },
          {
            role: 'user',
            content: `Summarize the following text${topicContext} in exactly 1-2 complete sentences. Capture the main points and key information as a flowing paragraph.

Requirements:
- Write 1-2 complete sentences only
- Do NOT use meta-phrases like "This text discusses" or "The document describes"
- State the information directly and factually
- Ensure sentences are complete (no cutoffs)

Text:
${content}

Summary:`,
          },
        ],
        max_tokens: 300, // Increased to allow full sentences
        temperature: 0.3,
      });
      
      const summary = response.choices[0]?.message?.content?.trim();
      
      // Validate we got a meaningful summary
      if (!summary || summary.length < 50) {
        console.warn(`LLM returned invalid summary with model ${currentModel}:`, summary);
        lastError = new Error(`LLM returned invalid or empty summary (${summary?.length || 0} chars)`);
        continue; // Try next model
      }
      
      // Check for incomplete sentences (ending with partial words/emails)
      if (summary.includes('@c') || summary.endsWith('@') || !summary.match(/[.!?]$/)) {
        console.warn(`Summary appears incomplete with model ${currentModel}:`, summary);
        lastError = new Error('Summary appears incomplete or cut off');
        continue; // Try next model
      }
      
      // Validate the summary is actually shorter than the original
      if (summary.length >= content.length * 0.9) {
        console.warn('LLM summary is not significantly shorter than original');
      }
      
      console.log(`✓ Successfully summarized ${content.length} chars to ${summary.length} chars using ${currentModel}`);
      return summary;
    } catch (error) {
      console.warn(`Model ${currentModel} failed:`, error);
      lastError = error as Error;
      continue; // Try next model
    }
  }
  
  // All models failed
  console.error('All LLM models failed for key point extraction');
  throw lastError || new Error('All LLM models failed to generate summary');
}

/**
 * Summarize a PDF chunk for memory creation.
 * @deprecated Use extractKeyPoints instead for better results
 */
export async function summarizePdfChunk(content: string): Promise<string> {
  const apiKey = getEnv('OPENROUTER_API_KEY');
  
  // Fallback if no API key
  if (!apiKey) {
    return content.substring(0, 200);
  }
  
  const client = getOpenAIClient();
  
  try {
    const response = await client.chat.completions.create({
      model: 'qwen/qwen3-235b-a22b:free',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise but informative memory summaries.',
        },
        {
          role: 'user',
          content: `Summarize the following text into a standalone memory. Capture the key facts and context so it makes sense on its own. Do not use phrases like "The text describes" or "This section discusses". Just state the facts.\n\nText:\n${content}`,
        },
      ],
      max_tokens: 200,
    });
    
    return response.choices[0]?.message?.content?.trim() || content.substring(0, 200);
  } catch (error) {
    console.error('LLM PDF chunk summarization failed:', error);
    return content.substring(0, 200);
  }
}

