-- Podcast learning-loop migration
-- Created 2026-04-29.
-- Adds 8 tables + 2 enums + 1 seeder function to support: signoff rotation,
-- semantic retrieval over episodes, prompt versioning, listener feedback
-- ingestion, narrative arcs across episodes, AI judgments of episode quality,
-- and a queue of proposed learnings/improvements.
--
-- Lives in the shared Silent Shield Supabase project (kpuqukppbmwebiptqmog).
-- All tables are namespaced clearly (host_signoffs, episode_*, etc.) so they
-- don't collide with the Fortress side of the database.
--
-- Idempotent: rerunnable via IF NOT EXISTS / DROP IF EXISTS guards.

-- pgvector for episode_embeddings semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE learning_kind AS ENUM ('prompt_change', 'rule_addition', 'voice_correction', 'topic_avoidance', 'metadata_fix');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE learning_status AS ENUM ('proposed', 'approved', 'applied', 'rejected', 'deferred');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── host_signoffs: per-user rotation pool ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.host_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS host_signoffs_user_id_idx ON public.host_signoffs(user_id);
CREATE INDEX IF NOT EXISTS host_signoffs_user_last_used_idx ON public.host_signoffs(user_id, last_used_at NULLS FIRST);

ALTER TABLE public.host_signoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own signoffs" ON public.host_signoffs;
CREATE POLICY "Users manage their own signoffs"
ON public.host_signoffs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Seeder: inserts 8 default phrases for a user. Idempotent — skips duplicates.
CREATE OR REPLACE FUNCTION public.seed_default_signoffs(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  inserted_count INTEGER := 0;
  default_phrases TEXT[] := ARRAY[
    'Fortune favors the fortified.',
    'Stay sharp out there.',
    'The work is the protection.',
    'Keep your edges hard and your head soft.',
    'Pay attention. Especially to the quiet things.',
    'Read your environment. Trust your instincts.',
    'Quiet is a discipline. So is patience.',
    'Be the one who notices.'
  ];
  p TEXT;
BEGIN
  FOREACH p IN ARRAY default_phrases LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.host_signoffs
      WHERE user_id = target_user_id AND phrase = p
    ) THEN
      INSERT INTO public.host_signoffs (user_id, phrase) VALUES (target_user_id, p);
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  RETURN inserted_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.seed_default_signoffs(UUID) TO authenticated;

-- ── episode_embeddings: pgvector embeddings for semantic episode retrieval ──
CREATE TABLE IF NOT EXISTS public.episode_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content_text TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (episode_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS episode_embeddings_episode_id_idx ON public.episode_embeddings(episode_id);
CREATE INDEX IF NOT EXISTS episode_embeddings_vec_idx ON public.episode_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.episode_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read episode_embeddings" ON public.episode_embeddings;
CREATE POLICY "Authenticated read episode_embeddings"
ON public.episode_embeddings FOR SELECT
USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Service role manages episode_embeddings" ON public.episode_embeddings;
CREATE POLICY "Service role manages episode_embeddings"
ON public.episode_embeddings FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ── prompt_versions: tracks every deployed prompt revision ───────────────
CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  prompt_text TEXT NOT NULL,
  prompt_hash TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_at TIMESTAMPTZ,
  UNIQUE (function_name, version)
);
CREATE INDEX IF NOT EXISTS prompt_versions_function_idx ON public.prompt_versions(function_name, version DESC);

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read prompt_versions" ON public.prompt_versions;
CREATE POLICY "Authenticated read prompt_versions"
ON public.prompt_versions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated insert prompt_versions" ON public.prompt_versions;
CREATE POLICY "Authenticated insert prompt_versions"
ON public.prompt_versions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── listener_feedback: captures inbound listener signal ──────────────────
CREATE TABLE IF NOT EXISTS public.listener_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID,
  source TEXT,
  feedback_type TEXT,
  content TEXT,
  rating NUMERIC,
  sentiment TEXT,
  raw_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listener_feedback_episode_idx ON public.listener_feedback(episode_id);
CREATE INDEX IF NOT EXISTS listener_feedback_created_idx ON public.listener_feedback(created_at DESC);

ALTER TABLE public.listener_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage listener_feedback" ON public.listener_feedback;
CREATE POLICY "Authenticated manage listener_feedback"
ON public.listener_feedback FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ── learnings: queue of proposed improvements ────────────────────────────
CREATE TABLE IF NOT EXISTS public.learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind learning_kind NOT NULL,
  status learning_status NOT NULL DEFAULT 'proposed',
  target_function TEXT,
  title TEXT NOT NULL,
  description TEXT,
  proposed_change TEXT,
  source_feedback_ids UUID[],
  source_episode_ids UUID[],
  proposed_by TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  applied_to_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learnings_status_idx ON public.learnings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS learnings_target_idx ON public.learnings(target_function);

ALTER TABLE public.learnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage learnings" ON public.learnings;
CREATE POLICY "Authenticated manage learnings"
ON public.learnings FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ── episode_arcs: narrative arcs spanning multiple episodes ──────────────
CREATE TABLE IF NOT EXISTS public.episode_arcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.episode_arcs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage episode_arcs" ON public.episode_arcs;
CREATE POLICY "Authenticated manage episode_arcs"
ON public.episode_arcs FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ── episode_arc_appearances: many-to-many between arcs and episodes ──────
CREATE TABLE IF NOT EXISTS public.episode_arc_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arc_id UUID NOT NULL REFERENCES public.episode_arcs(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (arc_id, episode_id)
);
CREATE INDEX IF NOT EXISTS episode_arc_appearances_arc_idx ON public.episode_arc_appearances(arc_id);
CREATE INDEX IF NOT EXISTS episode_arc_appearances_episode_idx ON public.episode_arc_appearances(episode_id);

ALTER TABLE public.episode_arc_appearances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage episode_arc_appearances" ON public.episode_arc_appearances;
CREATE POLICY "Authenticated manage episode_arc_appearances"
ON public.episode_arc_appearances FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ── episode_judgments: AI quality assessments per episode ────────────────
CREATE TABLE IF NOT EXISTS public.episode_judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL,
  judgment_type TEXT NOT NULL,
  score NUMERIC,
  pass_fail BOOLEAN,
  judge_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS episode_judgments_episode_idx ON public.episode_judgments(episode_id, created_at DESC);
CREATE INDEX IF NOT EXISTS episode_judgments_type_idx ON public.episode_judgments(judgment_type, score DESC);

ALTER TABLE public.episode_judgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read episode_judgments" ON public.episode_judgments;
CREATE POLICY "Authenticated read episode_judgments"
ON public.episode_judgments FOR SELECT
USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Service role manages episode_judgments" ON public.episode_judgments;
CREATE POLICY "Service role manages episode_judgments"
ON public.episode_judgments FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
