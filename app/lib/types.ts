/** TypeScript types and interfaces for the memory API */

// ==================== Memory Types ====================

export enum MemoryStatus {
  CURRENT = "current",
  OUTDATED = "outdated",
}

export interface MemoryBase {
  content: string;
  metadata?: Record<string, any>;
}

export interface MemoryCreate extends MemoryBase {}

export interface Memory {
  id: string;
  content: string;
  embedding_id: string;
  status: MemoryStatus;
  supersedes?: string | null;
  superseded_by?: string | null;
  entity_id?: string | null;
  metadata: Record<string, any>;
  created_at: Date | string;
}

export interface MemoryDocument {
  _id: string;
  content: string;
  embedding_id: string;
  status: MemoryStatus;
  supersedes?: string | null;
  superseded_by?: string | null;
  entity_id?: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

// ==================== Relationship Types ====================

export enum RelationshipType {
  UPDATE = "update",
  EXTEND = "extend",
  DERIVE = "derive",
}

export interface RelationshipBase {
  to: string;
  type: RelationshipType;
  description?: string | null;
}

export interface RelationshipCreate extends RelationshipBase {}

export interface Relationship {
  id: string;
  from_memory: string;
  to_memory: string;
  type: RelationshipType;
  description?: string | null;
  created_at: Date | string;
}

export interface RelationshipDocument {
  _id: string;
  from_memory: string;
  to_memory: string;
  type: RelationshipType;
  description?: string | null;
  created_at: Date;
}

// ==================== Entity Types ====================

export interface Entity {
  id: string;
  name: string;
  current_id?: string | null;
  history: string[];
  metadata: Record<string, any>;
}

export interface EntityDocument {
  _id: string;
  name: string;
  current_id?: string | null;
  history: string[];
  metadata: Record<string, any>;
}

// ==================== API Response Types ====================

export interface LineageResponse {
  memory: Memory;
  relationships: Relationship[];
  related_memories: Memory[];
}

export interface CreateMemoryRequest {
  content: string;
  metadata?: Record<string, any>;
}

export interface CreateRelationshipRequest {
  to: string;
  type: RelationshipType;
  description?: string;
}

// ==================== Pinecone Types ====================

export interface PineconeMetadata {
  memory_id: string;
  content: string;
  status: string;
}

export interface PineconeMatch {
  id: string;
  score: number;
  metadata: PineconeMetadata | Record<string, any>;
}

