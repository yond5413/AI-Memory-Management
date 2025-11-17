/** API client functions for communicating with the backend. */
import { createClient } from './supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

/**
 * Get auth headers for API requests
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  return headers;
}

export interface Memory {
  id: string;
  content: string;
  embedding_id: string;
  status: "current" | "outdated";
  supersedes?: string | null;
  superseded_by?: string | null;
  entity_id?: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Relationship {
  id: string;
  from_memory: string;
  to_memory: string;
  type: "update" | "extend" | "derive";
  description?: string | null;
  created_at: string;
}

export interface LineageResponse {
  memory: Memory;
  relationships: Relationship[];
  related_memories: Memory[];
}

export interface GraphResponse {
  memories: Memory[];
  relationships: Relationship[];
}

export interface CreateMemoryRequest {
  content: string;
  metadata?: Record<string, any>;
}

export interface CreateRelationshipRequest {
  to: string;
  type: "update" | "extend" | "derive";
  description?: string;
}

/** Create a memory from text */
export async function createMemory(data: CreateMemoryRequest): Promise<Memory> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create memory: ${response.statusText}`);
  }
  return response.json();
}

/** Create a memory from PDF file */
export async function createMemoryFromPDF(file: File): Promise<Memory> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const formData = new FormData();
  formData.append("file", file);
  
  const headers: HeadersInit = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}/memories/from-pdf`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Failed to create memory from PDF: ${response.statusText}`);
  }
  return response.json();
}

/** Get a memory by ID */
export async function getMemory(id: string): Promise<Memory> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/memories/${id}`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to get memory: ${response.statusText}`);
  }
  return response.json();
}

/** Get memory lineage */
export async function getMemoryLineage(id: string): Promise<LineageResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/memories/${id}/lineage`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to get lineage: ${response.statusText}`);
  }
  return response.json();
}

/** Create a relationship between memories */
export async function createRelationship(
  fromMemoryId: string,
  data: CreateRelationshipRequest
): Promise<Relationship> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/memories/${fromMemoryId}/relationships`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create relationship: ${response.statusText}`);
  }
  return response.json();
}

/** Semantic search */
export async function searchMemories(query: string): Promise<Memory[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to search: ${response.statusText}`);
  }
  return response.json();
}

/** Derive a memory from existing memories */
export async function deriveMemory(memoryIds: string[]): Promise<Memory> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/derive`, {
    method: "POST",
    headers,
    body: JSON.stringify(memoryIds),
  });
  if (!response.ok) {
    throw new Error(`Failed to derive memory: ${response.statusText}`);
  }
  return response.json();
}

/** Get all memories and relationships for graph visualization */
export async function getAllMemoriesGraph(): Promise<GraphResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/memories/graph`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to get graph data: ${response.statusText}`);
  }
  return response.json();
}

