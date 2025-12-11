-- Phase 4: Advanced Memory Architecture
-- Adds support for Atomic Memories, STM/LTM types, and User Meta-Summaries

-- 1. Update memories table
-- Add 'type' to distinguish 'stm' (Short Term) vs 'ltm' (Long Term)
ALTER TABLE public.memories 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'ltm' CHECK (type IN ('stm', 'ltm')),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Create user_meta_summaries table
-- Stores the high-level derived profile of the user (The "Real Gold" LTM Profile)
CREATE TABLE IF NOT EXISTS public.user_meta_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    sources JSONB DEFAULT '[]'::jsonb -- List of cluster_ids or memory_ids used to generate this
);

-- Enable RLS for user_meta_summaries
ALTER TABLE public.user_meta_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own meta summaries"
  ON public.user_meta_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_memories_type ON public.memories(type);
CREATE INDEX IF NOT EXISTS idx_user_meta_summaries_user_id ON public.user_meta_summaries(user_id);
