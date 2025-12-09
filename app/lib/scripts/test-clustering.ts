/**
 * Verification script for Clustering Logic.
 * Run with: npx ts-node app/lib/scripts/verify-clustering.ts
 */
import { runClustering } from '../services/clustering';

async function verify() {
    console.log('Starting Clustering Verification...');

    // Mock Data: 3 distinct clusters
    // 1. Cluster A: Near [0.1, 0.1]
    // 2. Cluster B: Near [0.8, 0.8]
    // 3. Cluster C: Near [0.4, 0.4] (maybe noise if epsilon is small?)
    const mockVectors = [
        { id: 'A1', values: [0.1, 0.1] },
        { id: 'A2', values: [0.11, 0.11] },
        { id: 'A3', values: [0.09, 0.09] },

        { id: 'B1', values: [0.8, 0.8] },
        { id: 'B2', values: [0.81, 0.81] },
        { id: 'B3', values: [0.79, 0.79] },

        { id: 'NOISE1', values: [0.5, 0.5] }
    ];

    console.log('Running DBSCAN (epsilon=0.1, minPoints=2)...');
    const results = await runClustering(mockVectors, 0.1, 2);

    console.log('Results:', JSON.stringify(results, null, 2));

    const clusters = results.filter(r => !r.noise);
    const noise = results.filter(r => r.noise);

    if (clusters.length === 2) {
        console.log('✅ Success: Found exactly 2 clusters as expected.');
    } else {
        console.error(`❌ Failure: Expected 2 clusters, found ${clusters.length}`);
    }

    if (noise.length > 0) {
        console.log('✅ Success: Identified noise correctly.');
    } else {
        console.warn('⚠️ Warning: No noise identified (expected 1 point).');
    }

    // Check cluster membership
    const clusterA = clusters.find(c => c.memoryIds.includes('A1'));
    if (clusterA && clusterA.memoryIds.includes('A2') && clusterA.memoryIds.includes('A3')) {
        console.log('✅ Success: Cluster A grouping is correct.');
    } else {
        console.error('❌ Failure: Cluster A grouping is incorrect.');
    }
}

verify().catch(console.error);
