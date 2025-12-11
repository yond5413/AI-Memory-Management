/** Supabase server-side client and utilities. */
import { createClient } from '@supabase/supabase-js';
import { getEnvOrThrow } from '../utils';

/**
 * Create a Supabase client for server-side operations.
 * Uses the service role key for privileged operations.
 */
export function createServiceClient() {
  const supabaseUrl = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceKey = getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client for server-side API routes.
 * Uses the anon key and respects user session.
 */
export function createServerClient() {
  const supabaseUrl = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Get the current user's ID from the Authorization header.
 * Returns null if not authenticated.
 */
export async function getUserIdFromRequest(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const supabase = createServerClient();
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user.id;
}

/**
 * Get user's default namespace.
 */
export async function getUserDefaultNamespace(userId: string): Promise<{
  pineconeNamespace: string;
  graphNamespace: string;
} | null> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('namespaces')
    .select('pinecone_namespace, graph_namespace')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();
  
  if (error || !data) {
    console.error('Error fetching user namespace:', error);
    return null;
  }
  
  return {
    pineconeNamespace: data.pinecone_namespace,
    graphNamespace: data.graph_namespace,
  };
}

/**
 * Ensure user has a default namespace (create if doesn't exist).
 */
export async function ensureUserNamespace(userId: string): Promise<{
  pineconeNamespace: string;
  graphNamespace: string;
}> {
  const existing = await getUserDefaultNamespace(userId);
  
  if (existing) {
    return existing;
  }
  
  // Create default namespace
  const supabase = createServiceClient();
  const pineconeNamespace = `user_${userId}`;
  const graphNamespace = `user_${userId}`;
  
  const { error } = await supabase
    .from('namespaces')
    .insert({
      user_id: userId,
      pinecone_namespace: pineconeNamespace,
      graph_namespace: graphNamespace,
      is_default: true,
    });
  
  if (error) {
    console.error('Error creating namespace:', error);
    throw new Error('Failed to create user namespace');
  }
  
  return {
    pineconeNamespace,
    graphNamespace,
  };
}

/**
 * Get user's preferred LLM model from settings.
 * Returns qwen as fallback if not found.
 */
export async function getUserLlmModel(userId: string): Promise<string> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('user_settings')
    .select('llm_model')
    .eq('user_id', userId)
    .single();
  
  if (error || !data?.llm_model) {
    console.log('Using fallback LLM model (qwen) for user:', userId);
    return 'qwen/qwen3-235b-a22b:free';
  }
  
  console.log('Using user LLM model:', data.llm_model, 'for user:', userId);
  return data.llm_model;
}

