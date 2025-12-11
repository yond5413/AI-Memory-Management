import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from database import get_supabase, get_pinecone_index, get_neo4j_driver, get_cohere_client
from services.utils import gen_id, normalize_datetime
import logging

logger = logging.getLogger(__name__)

class MemoryService:
    def __init__(self):
        self.supabase = get_supabase()
        self.pinecone = get_pinecone_index()
        self.neo4j = get_neo4j_driver()
        self.cohere = get_cohere_client()

    async def create_embedding(self, text: str, input_type: str = 'search_document') -> List[float]:
        if not self.cohere:
            logger.warning("Cohere client not initialized")
            return []
        
        response = self.cohere.embed(
            texts=[text],
            model='embed-english-v3.0',
            input_type=input_type
        )
        return response.embeddings[0]

    async def add_short_term_memory(self, user_id: str, content: str, metadata: Dict[str, Any] = {}) -> Dict[str, Any]:
        """
        Add a short-term memory (STM). 
        STM is stored in Supabase 'memories' with type='stm'.
        It is NOT immediately embedded or added to Graph/Pinecone, usually.
        But for MVP simplicity, we might just store it.
        """
        memory_id = gen_id('mem')
        
        data = {
            "id": memory_id,
            "user_id": user_id,
            "content": content,
            "type": "stm",
            "metadata": metadata,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Insert into Supabase
        res = self.supabase.table("memories").insert(data).execute()
        return res.data[0] if res.data else None

    async def add_long_term_memory(self, user_id: str, content: str, metadata: Dict[str, Any] = {}, namespace: str = None) -> Dict[str, Any]:
        """
        Add a long-term memory (LTM).
        1. Create Embedding.
        2. Store in Supabase (type='ltm').
        3. Upsert to Pinecone.
        4. Create Node in Neo4j.
        """
        memory_id = gen_id('mem')
        embedding_id = gen_id('vec')
        
        # 1. Create Embedding
        vector = await self.create_embedding(content)
        
        # 2. Store in Supabase
        data = {
            "id": memory_id,
            "user_id": user_id,
            "content": content,
            "type": "ltm",
            "embedding_id": embedding_id, 
            "metadata": metadata,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        res = self.supabase.table("memories").insert(data).execute()
        memory_record = res.data[0] if res.data else None

        # 3. Upsert to Pinecone
        if vector:
            pc_metadata = {
                "memory_id": memory_id,
                "content": content[:200],
                "user_id": user_id,
                "type": "ltm",
                **metadata
            }
            # Use namespace if provided, usually user_{id}_ltm or just passed namespace
            target_namespace = namespace or f"user_{user_id}_ltm"
            self.pinecone.upsert(vectors=[(embedding_id, vector, pc_metadata)], namespace=target_namespace)

        # 4. Create Node in Neo4j
        if self.neo4j:
            with self.neo4j.session() as session:
                cypher = """
                MERGE (u:User {id: $user_id})
                CREATE (m:Memory {
                    id: $id,
                    content: $content,
                    vector_id: $vector_id,
                    type: 'ltm',
                    metadata: $metadata,
                    created_at: datetime($created_at)
                })
                CREATE (u)-[:OWNS]->(m)
                RETURN m
                """
                session.run(cypher, 
                            user_id=user_id,
                            id=memory_id,
                            content=content,
                            vector_id=embedding_id,
                            metadata=json.dumps(metadata),
                            created_at=data["created_at"])
        
        return memory_record

    async def get_stm_history(self, user_id: str, limit: int = 10):
        """Fetch recent Short-Term Memories for context."""
        res = self.supabase.table("memories")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("type", "stm")\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        return res.data

    async def get_ltm_history(self, user_id: str, limit: int = 10):
        """Fetch recent Long-Term Memories."""
        res = self.supabase.table("memories")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("type", "ltm")\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        return res.data
