/** Relationship service functions. */
import { getDb } from './mongodb';
import { genId } from '../utils';
import {
  Relationship,
  RelationshipCreate,
  RelationshipDocument,
  RelationshipType,
  MemoryStatus,
} from '../types';

/**
 * Create a relationship between two memories.
 */
export async function createRelationship(
  fromMemoryId: string,
  relationship: RelationshipCreate
): Promise<Relationship> {
  const db = getDb();
  
  // Generate relationship ID
  const relationshipId = genId('rel');
  
  // Handle UPDATE relationship type (marks old memory as outdated)
  if (relationship.type === RelationshipType.UPDATE) {
    await db.collection('memories').updateOne(
      { _id: fromMemoryId } as any,
      {
        $set: {
          status: MemoryStatus.OUTDATED,
          superseded_by: relationship.to,
        },
      }
    );
    
    await db.collection('memories').updateOne(
      { _id: relationship.to } as any,
      { $set: { supersedes: fromMemoryId } }
    );
  }
  
  // Create relationship document
  const relationshipDoc: RelationshipDocument = {
    _id: relationshipId,
    from_memory: fromMemoryId,
    to_memory: relationship.to,
    type: relationship.type,
    description: relationship.description || null,
    created_at: new Date(),
  };
  
  // Insert into MongoDB
  await db.collection('relationships').insertOne(relationshipDoc as any);
  
  // Return response
  return {
    id: relationshipId,
    from_memory: relationshipDoc.from_memory,
    to_memory: relationshipDoc.to_memory,
    type: relationshipDoc.type,
    description: relationshipDoc.description,
    created_at: relationshipDoc.created_at,
  };
}

/**
 * Get a relationship by ID.
 */
export async function getRelationship(
  relationshipId: string
): Promise<Relationship | null> {
  const db = getDb();
  
  const relationshipDoc = await db
    .collection('relationships')
    .findOne({ _id: relationshipId } as any);
  
  if (!relationshipDoc) {
    return null;
  }
  
  return {
    id: String(relationshipDoc._id),
    from_memory: relationshipDoc.from_memory,
    to_memory: relationshipDoc.to_memory,
    type: relationshipDoc.type,
    description: relationshipDoc.description,
    created_at: relationshipDoc.created_at,
  };
}

/**
 * Get all relationships for a memory.
 */
export async function getMemoryRelationships(
  memoryId: string
): Promise<Relationship[]> {
  const db = getDb();
  
  const relationships = await db
    .collection('relationships')
    .find({
      $or: [{ from_memory: memoryId }, { to_memory: memoryId }],
    })
    .toArray();
  
  return relationships.map((doc) => ({
    id: String(doc._id),
    from_memory: doc.from_memory,
    to_memory: doc.to_memory,
    type: doc.type,
    description: doc.description,
    created_at: doc.created_at,
  }));
}

/**
 * Delete a relationship.
 */
export async function deleteRelationship(relationshipId: string): Promise<void> {
  const db = getDb();
  
  await db.collection('relationships').deleteOne({ _id: relationshipId } as any);
}

