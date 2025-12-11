import numpy as np
from sklearn.cluster import DBSCAN
from typing import List, Dict, Any
import json
from uuid import uuid4
from datetime import datetime
import logging

from database import get_pinecone_index, get_supabase, get_neo4j_driver, get_cohere_client
from services.utils import gen_id

logger = logging.getLogger(__name__)

class ClusteringService:
    def __init__(self):
        self.pinecone = get_pinecone_index()
        self.supabase = get_supabase()
        self.neo4j = get_neo4j_driver()
        self.cohere = get_cohere_client()

    async def run_clustering_for_user(self, user_id: str, namespace: str = None):
        """
        Fetch all vectors for user, run clustering, update DB/Graph.
        """
        namespace = namespace or f"user_{user_id}_ltm"
        
        # 1. Fetch vectors
        # Note: Pinecone list/fetch is limited. For prod, iterate or use metadata filter if possible.
        # For prototype, we assume fetching top 2000 via dummy query.
        vectors = await self._fetch_all_vectors(namespace)
        if not vectors:
            logger.info("No vectors found for clustering.")
            return

        ids = [v['id'] for v in vectors]
        embeddings = np.array([v['values'] for v in vectors])
        
        # 2. Run DBSCAN
        # eps=0.5 (cosine distance threshold), min_samples=3
        # Adjust eps based on embedding model distribution
        clustering = DBSCAN(eps=0.4, min_samples=2, metric='cosine').fit(embeddings)
        labels = clustering.labels_
        
        # 3. Process Clusters
        unique_labels = set(labels)
        logger.info(f"Found {len(unique_labels)} clusters (including noise -1)")
        
        # Mapping: cluster_label -> list of memory_ids
        cluster_map = {label: [] for label in unique_labels if label != -1}
        
        # Update Neo4j/Supabase
        for idx, label in enumerate(labels):
            if label == -1:
                continue # Noise
            
            memory_embedding_id = ids[idx]
            # We need to map embedding_id back to memory_id. 
            # Ideally fetched from metadata.
            memory_id = vectors[idx]['metadata'].get('memory_id')
            if not memory_id:
                continue

            cluster_map[label].append(memory_id)
            
            # Note: A "Cluster" entity needs to persist. 
            # We should check if we can map numeric label back to an existing Cluster UUID?
            # Creating stable cluster IDs is hard with DBSCAN re-runs.
            # Strategy: Create new Run ID or try to match centroids.
            # efficient Strategy: Just create new Clusters for this run and archive old?
            # Or simplified: Just link Memory to a Topic string for now?
            # User wants "Cluster IDs: -cluster_7a23b".
            # We will create a new Cluster object for each label in this run.
            
        # Create Cluster Nodes
        for label, mem_ids in cluster_map.items():
            cluster_id = f"cluster_{uuid4().hex[:8]}"
            
            # Generate Summary for this cluster
            summary = await self._summarize_cluster(mem_ids)
            
            # Store Cluster Metadata in Supabase
            self.supabase.table("cluster_summaries").insert({
                "user_id": user_id,
                "cluster_id": cluster_id,
                "summary": summary,
                "created_at": datetime.now().isoformat()
            }).execute()

            # Link in Neo4j
            if self.neo4j:
                with self.neo4j.session() as session:
                    # Create Cluster Node
                    session.run("""
                        MERGE (u:User {id: $user_id})
                        CREATE (c:Cluster {id: $cluster_id, summary: $summary})
                        MERGE (u)-[:HAS_TOPIC]->(c)
                    """, user_id=user_id, cluster_id=cluster_id, summary=summary)
                    
                    # Link Memories
                    session.run("""
                        MATCH (c:Cluster {id: $cluster_id})
                        MATCH (m:Memory) WHERE m.id IN $mem_ids
                        MERGE (m)-[:BELONGS_TO]->(c)
                    """, cluster_id=cluster_id, mem_ids=mem_ids)

    async def _fetch_all_vectors(self, namespace: str):
        # Implementation similar to frontend hack: query with zero vector
        dummy_vector = [0.0] * 1024 # Model dimensions differ! Cohere v3 is 1024 floats usually?
        # Check cohere model dim. embed-english-v3.0 is 1024.
        
        res = self.pinecone.query(
            vector=dummy_vector,
            top_k=2000,
            namespace=namespace,
            include_values=True,
            include_metadata=True
        )
        return res.matches

    async def _summarize_cluster(self, memory_ids: List[str]) -> str:
        # Fetch content from Supabase
        res = self.supabase.table("memories").select("content").in_("id", memory_ids).execute()
        contents = [r['content'] for r in res.data]
        text = "\n".join(contents[:10]) # Limit to 10 for summary context
        
        # Call LLM (using Cohere Chat or OpenAI)
        # Using Cohere for consistency if available, or OpenAI
        if self.cohere:
            response = self.cohere.chat(
                message=f"Summarize these memories into a single topic description (e.g. 'User interests in Football'):\n\n{text}",
                model="command-r-08-2024"
            )
            return response.text
        return "Cluster Summary"
