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
  type Memory,
  type LineageResponse,
  type CreateMemoryRequest,
  type CreateRelationshipRequest,
} from "@/app/lib/api";

export function useMemory(id: string | null) {
  return useSWR<Memory>(id ? `/memories/${id}` : null, () => (id ? getMemory(id) : null));
}

export function useMemoryLineage(id: string | null) {
  return useSWR<LineageResponse>(
    id ? `/memories/${id}/lineage` : null,
    () => (id ? getMemoryLineage(id) : null)
  );
}

export function useSearch(query: string | null) {
  return useSWR<Memory[]>(
    query ? `/search?q=${encodeURIComponent(query)}` : null,
    () => (query ? searchMemories(query) : null)
  );
}

// Mutations (not using SWR)
export const memoryMutations = {
  create: createMemory,
  createFromPDF: createMemoryFromPDF,
  createRelationship: createRelationship,
  derive: deriveMemory,
};

