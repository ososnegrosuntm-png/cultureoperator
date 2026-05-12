-- ── Migration 006: Syndicate Knowledge (coach-tagged RAG) ────────────────────
-- Separate from knowledge_base (framework-tagged). This table stores content
-- chunks tagged by Syndicate coach name for RAG-grounded message generation.
-- Coaches: ATLAS (Fitness), FORGE (Nutrition), IRON (Mental),
--          HAVEN (Recovery), APEX (Business), COMPASS (Synthesis)

CREATE TABLE IF NOT EXISTS public.syndicate_knowledge (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_name    text        NOT NULL
                            CHECK (coach_name IN ('ATLAS','FORGE','IRON','HAVEN','APEX','COMPASS')),
  source_title  text        NOT NULL,
  source_author text        NOT NULL DEFAULT '',
  content_chunk text        NOT NULL,
  embedding     vector(1536),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- HNSW index for fast cosine-distance ANN search
CREATE INDEX IF NOT EXISTS syndicate_knowledge_embedding_idx
  ON public.syndicate_knowledge
  USING hnsw (embedding vector_cosine_ops);

-- Btree index on coach_name for filtered queries
CREATE INDEX IF NOT EXISTS syndicate_knowledge_coach_idx
  ON public.syndicate_knowledge (coach_name);

-- Semantic search function
CREATE OR REPLACE FUNCTION match_syndicate_knowledge(
  query_embedding  vector(1536),
  match_count      int  DEFAULT 5,
  filter_coach     text DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  coach_name    text,
  source_title  text,
  source_author text,
  content_chunk text,
  similarity    float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sk.id,
    sk.coach_name,
    sk.source_title,
    sk.source_author,
    sk.content_chunk,
    1 - (sk.embedding <=> query_embedding) AS similarity
  FROM public.syndicate_knowledge sk
  WHERE sk.embedding IS NOT NULL
    AND (filter_coach IS NULL OR sk.coach_name = filter_coach)
  ORDER BY sk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Row Level Security
ALTER TABLE public.syndicate_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_users_select_sk"
  ON public.syndicate_knowledge
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_role_full_access_sk"
  ON public.syndicate_knowledge
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
