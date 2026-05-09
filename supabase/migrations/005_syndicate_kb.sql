-- ── Migration 005: Syndicate Knowledge Base ────────────────────────────────────
-- Adds pgvector extension + knowledge_base table for RAG retrieval.
-- Frameworks: Hormozi, Cooper, Frisella, Bailey, Mongol Code
-- Embedding model: OpenAI text-embedding-3-small (1536 dimensions)
-- Used by ATLAS and IRON coaches for context-aware message generation.

-- 1. pgvector extension --------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. knowledge_base table ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  framework    text        NOT NULL
                           CHECK (framework IN (
                             'hormozi', 'cooper', 'frisella', 'bailey', 'mongol_code'
                           )),
  source_title text        NOT NULL,          -- e.g. "100M Offers - Chapter 3"
  chunk_index  integer     NOT NULL,          -- order within the source document
  content      text        NOT NULL,          -- the raw chunk text
  embedding    vector(1536),                  -- null until embedded via OpenAI
  metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. HNSW index for fast cosine-distance ANN search ---------------------------
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_hnsw_idx
  ON public.knowledge_base
  USING hnsw (embedding vector_cosine_ops);

-- 4. Btree index on framework for filtered queries ----------------------------
CREATE INDEX IF NOT EXISTS knowledge_base_framework_idx
  ON public.knowledge_base (framework);

-- 5. Semantic search function --------------------------------------------------
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding  vector(1536),
  match_count      int     DEFAULT 5,
  filter_framework text    DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  framework    text,
  source_title text,
  content      text,
  similarity   float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.framework,
    kb.source_title,
    kb.content,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE kb.embedding IS NOT NULL
    AND (filter_framework IS NULL OR kb.framework = filter_framework)
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Row Level Security --------------------------------------------------------
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Authenticated users: read only
CREATE POLICY "authenticated_users_select_kb"
  ON public.knowledge_base
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role: full access (bypasses RLS by default in Supabase,
-- but explicit policy ensures clarity if RLS is force-enabled)
CREATE POLICY "service_role_full_access_kb"
  ON public.knowledge_base
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
