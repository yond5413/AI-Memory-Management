/**
 * Clustering service using density-clustering to group memories.
 */
// @ts-ignore - density-clustering types can be flaky
import { DBSCAN } from 'density-clustering';
import { createServiceClient } from './supabase';
import { executeWrite } from './neo4j';

export interface ClusteringResult {
  clusterId: number;
  memoryIds: string[];
  noise: boolean;
}

interface VectorPoint {
  id: string; // Memory ID
  values: number[]; // Embedding vector
}

/**
 * Run clustering on a set of vectors.
 * Uses DBSCAN (Density-Based Spatial Clustering of Applications with Noise).
 * 
 * @param vectors List of vectors with IDs
 * @param epsilon Neighborhood radius (similarity threshold)
 * @param minPoints Minimum points to form a dense region
 */
export async function runClustering(
  vectors: VectorPoint[],
  epsilon: number = 0.5,
  minPoints: number = 3
): Promise<ClusteringResult[]> {
  if (vectors.length === 0) return [];

  const dbscan = new DBSCAN();

  // DBSCAN expects dataset as array of arrays: [[1, 2], [1, 3], ...]
  const dataset = vectors.map(v => v.values);

  // Run clustering
  // Returns array of clusters, where each cluster is an array of indices: [[0, 1, 3], [2, 5]]
  const clustersIndices = dbscan.run(dataset, epsilon, minPoints);
  const noiseIndices = dbscan.noise;

  const results: ClusteringResult[] = [];

  // specific type for clusters
  clustersIndices.forEach((indices: number[], clusterIdx: number) => {
    const memoryIds = indices.map(idx => vectors[idx].id);
    results.push({
      clusterId: clusterIdx,
      memoryIds,
      noise: false
    });
  });

  // Handle noise
  if (noiseIndices && noiseIndices.length > 0) {
    const noiseMemoryIds = noiseIndices.map((idx: number) => vectors[idx].id);
    results.push({
      clusterId: -1,
      memoryIds: noiseMemoryIds,
      noise: true
    });
  }

  return results;
}

/**
 * Save clustering results to Supabase and Neo4j.
 */
export async function saveClusterAssignments(
  userId: string,
  assignments: ClusteringResult[]
) {
  const supabase = createServiceClient();

  const now = new Date().toISOString();

  // 1. Prepare Supabase inserts
  const records: any[] = [];

  for (const cluster of assignments) {
    if (cluster.noise) continue;

    const clusterLabel = `cluster_${cluster.clusterId}`;

    for (const memId of cluster.memoryIds) {
      records.push({
        user_id: userId,
        memory_id: memId,
        cluster_id: clusterLabel,
        confidence: 1.0,
        created_at: now,
        updated_at: now
      });
    }
  }

  if (records.length > 0) {
    const { error } = await supabase
      .from('memory_clusters')
      .upsert(records, { onConflict: 'memory_id' });

    if (error) {
      console.error('Error saving cluster assignments:', error);
      throw error;
    }
  }

  // 2. Sync to Neo4j
  for (const cluster of assignments) {
    if (cluster.noise) continue;

    const clusterLabel = `cluster_${cluster.clusterId}`;

    const cypher = `
      MERGE (c:Cluster {cluster_id: $clusterId, user_id: $userId})
      SET c.updated_at = datetime($now)
      WITH c
      UNWIND $memoryIds AS memId
      MATCH (m:Memory {id: memId})
      MERGE (m)-[:BELONGS_TO]->(c)
    `;

    try {
      await executeWrite(cypher, {
        clusterId: clusterLabel,
        userId,
        memoryIds: cluster.memoryIds,
        now
      });
    } catch (error) {
      console.error('Error syncing clusters to Neo4j:', error);
    }
  }
}
