/** React hooks for API calls using SWR. */
"use client";

import useSWR from "swr";
import {
  createMemory,
  createMemoryFromPDF,
  getMemory,
  getMemoryLineage,
  createRelationship,
  searchMemories,
  deriveMemory,
  getAllMemoriesGraph,
  type Memory,
  type LineageResponse,
  type GraphResponse,
  type CreateMemoryRequest,
  type CreateRelationshipRequest,
} from "@/app/lib/api";

export function useMemory(id: string | null) {
  return useSWR<Memory>(id ? `/memories/${id}` : null, id ? () => getMemory(id) : null);
}

export function useMemoryLineage(id: string | null) {
  return useSWR<LineageResponse>(
    id ? `/memories/${id}/lineage` : null,
    id ? () => getMemoryLineage(id) : null
  );
}

export function useSearch(query: string | null) {
  return useSWR<Memory[]>(
    query ? `/search?q=${encodeURIComponent(query)}` : null,
    query ? () => searchMemories(query) : null
  );
}

export function useMemoryGraph() {
  return useSWR<GraphResponse>(
    '/memories/graph',
    getAllMemoriesGraph,
    {
      refreshInterval: 5000, // Refresh every 5 seconds to show new memories
    }
  );
}

// Mutations (not using SWR)
export const memoryMutations = {
  create: createMemory,
  createFromPDF: createMemoryFromPDF,
  createRelationship: createRelationship,
  derive: deriveMemory,
};


