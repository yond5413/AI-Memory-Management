/**
 * API route to trigger clustering manually.
 * In production, this should be protected or called by a cron job.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runClustering, saveClusterAssignments, ClusteringResult } from '@/app/lib/services/clustering';
import { getUserDefaultNamespace, getUserIdFromRequest } from '@/app/lib/services/supabase';
import { getVectorsForClustering } from '@/app/lib/services/pinecone';

export async function POST(request: NextRequest) {
    try {
        // 1. Auth check
        const authHeader = request.headers.get('Authorization');
        const userId = await getUserIdFromRequest(authHeader);

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const namespaces = await getUserDefaultNamespace(userId);
        if (!namespaces) {
            return NextResponse.json({ error: 'User namespace not found' }, { status: 404 });
        }

        // 2. Fetch vectors
        // Warning: Pinecone doesn't allow dumping all vectors easily without metadata filtering or iterative fetch.
        // For MVP, we'll fetch recently active or try to iterate. 
        // Ideally we iterate over IDs from Supabase 'memories' table and then fetch vectors.
        const vectors = await getVectorsForClustering(namespaces.pineconeNamespace);

        if (vectors.length < 3) {
            return NextResponse.json({
                message: 'Not enough memories to cluster (minimum 3)',
                count: vectors.length
            });
        }

        // 3. Run Clustering
        console.log(`Running clustering for user ${userId} on ${vectors.length} vectors...`);
        const results: ClusteringResult[] = await runClustering(vectors);

        // 4. Save Results
        await saveClusterAssignments(userId, results);

        return NextResponse.json({
            success: true,
            clusters_found: results.filter(c => !c.noise).length,
            total_vectors_processed: vectors.length,
            noise_points: results.find(c => c.noise)?.memoryIds.length || 0,
            cluster_details: results
        });

    } catch (error) {
        console.error('Clustering failed:', error);
        return NextResponse.json(
            { error: 'Clustering job failed', details: String(error) },
            { status: 500 }
        );
    }
}
