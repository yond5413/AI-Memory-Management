-- Phase 5: PDF Processing Jobs for Background Task Tracking
-- Enables job status tracking and progress monitoring for PDF processing

-- 0. Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create pdf_processing_jobs table
CREATE TABLE IF NOT EXISTS public.pdf_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_sections INT DEFAULT 0,
  processed_sections INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.pdf_processing_jobs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can view their own processing jobs"
  ON public.pdf_processing_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own processing jobs"
  ON public.pdf_processing_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own processing jobs"
  ON public.pdf_processing_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Service role bypass for backend operations
CREATE POLICY "Service role has full access to processing jobs"
  ON public.pdf_processing_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdf_processing_jobs_user_id ON public.pdf_processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_processing_jobs_status ON public.pdf_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pdf_processing_jobs_created_at ON public.pdf_processing_jobs(created_at DESC);

-- 6. Trigger for updated_at
DROP TRIGGER IF EXISTS update_pdf_processing_jobs_updated_at ON public.pdf_processing_jobs;
CREATE TRIGGER update_pdf_processing_jobs_updated_at
  BEFORE UPDATE ON public.pdf_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
