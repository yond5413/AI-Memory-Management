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
      model: 'minimax/minimax-m2:free',
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

