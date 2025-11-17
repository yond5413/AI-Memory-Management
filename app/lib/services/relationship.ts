/** Relationship service functions. */
import { executeWrite, executeRead } from './neo4j';
import { genId } from '../utils';
import {
  Relationship,
  RelationshipCreate,
  RelationshipType,
  MemoryStatus,
} from '../types';

interface Neo4jRelationship {
  r: {
    properties: {
      id: string;
      description: string | null;
      created_at: string;
    };
  };
  fromId: string;
  toId: string;
  type: string;
}

/**
 * Create a relationship between two memories.
 */
export async function createRelationship(
  fromMemoryId: string,
  relationship: RelationshipCreate
): Promise<Relationship> {
  // Generate relationship ID
  const relationshipId = genId('rel');
  const now = new Date().toISOString();
  
  // Determine relationship type label
  const relType = relationship.type.toUpperCase();
  
  // Handle UPDATE relationship type (marks old memory as outdated)
  if (relationship.type === RelationshipType.UPDATE) {
    const updateCypher = `
      MATCH (from:Memory {id: $fromId})
      MATCH (to:Memory {id: $toId})
      SET from.status = $status,
          from.superseded_by = $toId,
          from.updated_at = datetime($updated_at)
      SET to.supersedes = $fromId,
          to.updated_at = datetime($updated_at)
      MERGE (from)-[r:UPDATES {
        id: $id,
        description: $description,
        created_at: datetime($created_at)
      }]->(to)
      RETURN r, from.id as fromId, to.id as toId, type(r) as type
    `;
    
    const results = await executeWrite<Neo4jRelationship>(updateCypher, {
      fromId: fromMemoryId,
      toId: relationship.to,
      status: MemoryStatus.OUTDATED,
      id: relationshipId,
      description: relationship.description || null,
      created_at: now,
      updated_at: now,
    });
    
    if (results.length === 0) {
      throw new Error('Failed to create UPDATE relationship');
    }
    
    const result = results[0];
    return {
      id: result.r.properties.id,
      from_memory: result.fromId,
      to_memory: result.toId,
      type: relationship.type,
      description: result.r.properties.description,
      created_at: result.r.properties.created_at,
    };
  }
  
  // Create other relationship types (EXTEND, DERIVE)
  const cypher = `
    MATCH (from:Memory {id: $fromId})
    MATCH (to:Memory {id: $toId})
    MERGE (from)-[r:${relType} {
      id: $id,
      description: $description,
      created_at: datetime($created_at)
    }]->(to)
    RETURN r, from.id as fromId, to.id as toId, type(r) as type
  `;
  
  const results = await executeWrite<Neo4jRelationship>(cypher, {
    fromId: fromMemoryId,
    toId: relationship.to,
    id: relationshipId,
    description: relationship.description || null,
    created_at: now,
  });
  
  if (results.length === 0) {
    throw new Error('Failed to create relationship');
  }
  
  const result = results[0];
  return {
    id: result.r.properties.id,
    from_memory: result.fromId,
    to_memory: result.toId,
    type: relationship.type,
    description: result.r.properties.description,
    created_at: result.r.properties.created_at,
  };
}

/**
 * Get a relationship by ID.
 */
export async function getRelationship(
  relationshipId: string
): Promise<Relationship | null> {
  const cypher = `
    MATCH (from:Memory)-[r]->(to:Memory)
    WHERE r.id = $id
    RETURN r, from.id as fromId, to.id as toId, type(r) as type
  `;
  
  const results = await executeRead<Neo4jRelationship>(cypher, { id: relationshipId });
  
  if (results.length === 0) {
    return null;
  }
  
  const result = results[0];
  return {
    id: result.r.properties.id,
    from_memory: result.fromId,
    to_memory: result.toId,
    type: result.type.toLowerCase() as RelationshipType,
    description: result.r.properties.description,
    created_at: result.r.properties.created_at,
  };
}

/**
 * Get all relationships for a memory.
 */
export async function getMemoryRelationships(
  memoryId: string
): Promise<Relationship[]> {
  const cypher = `
    MATCH (m:Memory {id: $id})
    OPTIONAL MATCH (m)-[r_out]->(other_out:Memory)
    OPTIONAL MATCH (other_in:Memory)-[r_in]->(m)
    WITH 
      COLLECT({r: r_out, fromId: m.id, toId: other_out.id, type: type(r_out)}) +
      COLLECT({r: r_in, fromId: other_in.id, toId: m.id, type: type(r_in)}) as allRels
    UNWIND allRels as rel
    WITH rel
    WHERE rel.r IS NOT NULL
    RETURN rel.r as r, rel.fromId as fromId, rel.toId as toId, rel.type as type
  `;
  
  const results = await executeRead<Neo4jRelationship>(cypher, { id: memoryId });
  
  return results.map((result) => ({
    id: result.r.properties.id,
    from_memory: result.fromId,
    to_memory: result.toId,
    type: result.type.toLowerCase() as RelationshipType,
    description: result.r.properties.description,
    created_at: result.r.properties.created_at,
  }));
}

/**
 * Delete a relationship.
 */
export async function deleteRelationship(relationshipId: string): Promise<void> {
  const cypher = `
    MATCH ()-[r]->()
    WHERE r.id = $id
    DELETE r
  `;
  
  await executeWrite(cypher, { id: relationshipId });
}

