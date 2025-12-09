-- Phase 3: Clustering and Memories Table

-- 1. Create memories table
CREATE TABLE IF NOT EXISTS public.memories (
  id TEXT PRIMARY KEY, -- Matches genId format (e.g., mem_xxxx)
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  embedding_id TEXT, -- To link to Pinecone vector ID if needed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for memories
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memories"
  ON public.memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own memories"
  ON public.memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
  ON public.memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
  ON public.memories FOR DELETE
  USING (auth.uid() = user_id);


-- 2. Create memory_clusters table
CREATE TABLE IF NOT EXISTS public.memory_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  memory_id TEXT NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  cluster_id TEXT NOT NULL,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for memory_clusters
ALTER TABLE public.memory_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memory clusters"
  ON public.memory_clusters FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Create cluster_summaries table
CREATE TABLE IF NOT EXISTS public.cluster_summaries (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
   cluster_id TEXT NOT NULL,
   summary TEXT,
   -- embedding VECTOR(1536), -- Commented out to avoid dependency on pgvector extension presence in this specific migration file unless confirmed enabled.
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for cluster_summaries
ALTER TABLE public.cluster_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cluster summaries"
  ON public.cluster_summaries FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_clusters_user_id ON public.memory_clusters(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_clusters_cluster_id ON public.memory_clusters(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_summaries_user_id ON public.cluster_summaries(user_id);
