-- IRIS Knowledge System - Full Database Schema
-- Phase 1: Foundation for contact profiles, embeddings, and processing pipeline

-- Enable vector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Contact Profiles Table
-- ============================================
-- Unified contact system with Austin's requirements:
-- - Store BOTH phone numbers (mobile + office)
-- - Rich context from email interactions
-- - Source traceability via thread links

CREATE TABLE IF NOT EXISTS contact_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone_mobile TEXT,
  phone_office TEXT,
  company TEXT,
  title TEXT,
  
  -- Role/Context
  responsibilities TEXT[],              -- What they handle: ["permits", "inspections", "reviews"]
  working_relationship JSONB,           -- How we work with them, preferences, history
  context TEXT,                         -- Free-form context from interactions
  
  -- Source Traceability
  source_threads TEXT[],                -- Email thread IDs where info was extracted
  
  -- External IDs for deduplication
  ms365_id TEXT,                        -- Microsoft 365 contact ID
  icloud_id TEXT,                       -- iCloud contact ID
  
  -- Quality/Confidence
  confidence DECIMAL(3,2),              -- How confident we are in the data (0.00-1.00)
  
  -- Timestamps
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for contact lookup
CREATE INDEX IF NOT EXISTS idx_contact_profiles_email ON contact_profiles(email);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_company ON contact_profiles(company);
CREATE INDEX IF NOT EXISTS idx_contact_profiles_name ON contact_profiles USING gin(to_tsvector('english', name));

-- ============================================
-- Knowledge Embeddings Table
-- ============================================
-- Vector embeddings for semantic search across all project knowledge

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  project_id TEXT,                       -- BSE project number (e.g., "24-01")
  thread_id TEXT,                        -- Email conversation ID
  
  -- Content
  content TEXT NOT NULL,                 -- The text that was embedded
  embedding vector(1536),                -- OpenAI ada-002 embedding (1536 dims)
  
  -- Metadata
  metadata JSONB,                        -- Subject, from, date, category, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for embedding search
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_thread ON knowledge_embeddings(thread_id);

-- Vector similarity search index (IVFFlat for large datasets)
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- Email Processing Log
-- ============================================
-- Tracks what has been processed, quality scores, and extraction results

CREATE TABLE IF NOT EXISTS email_processing_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Email Identification
  thread_id TEXT UNIQUE NOT NULL,
  subject TEXT,
  from_address TEXT,
  date TIMESTAMPTZ,
  
  -- Processing Results
  project_id TEXT,                       -- Assigned project
  confidence DECIMAL(3,2),               -- AI confidence in assignment
  insights_extracted JSONB,              -- What was learned: {decisions, deadlines, commitments, contacts}
  contacts_updated TEXT[],               -- Contact IDs that were updated from this email
  
  -- Plaud-specific
  plaud_transcript_id TEXT,              -- If this is a Plaud transcript
  
  -- Processing Metadata
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_agent TEXT,                 -- Which agent processed it
  quality_score DECIMAL(3,2),            -- Quality of extraction (0.00-10.00)
  
  -- Status
  status TEXT DEFAULT 'processed' CHECK (status IN ('processed', 'needs_review', 'failed', 'skipped'))
);

-- Indexes for processing queries
CREATE INDEX IF NOT EXISTS idx_processing_thread ON email_processing_log(thread_id);
CREATE INDEX IF NOT EXISTS idx_processing_project ON email_processing_log(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_status ON email_processing_log(status);
CREATE INDEX IF NOT EXISTS idx_processing_date ON email_processing_log(date);

-- ============================================
-- Processing Queue
-- ============================================
-- Queue for parallel processing of email backfill

CREATE TABLE IF NOT EXISTS processing_queue (
  id BIGSERIAL PRIMARY KEY,
  
  -- Email Identification
  thread_id TEXT UNIQUE NOT NULL,
  folder TEXT,                           -- Source folder path
  subject TEXT,
  
  -- Priority (Austin's requirements)
  -- 1 = Subfolder emails (project-specific, highest value)
  -- 2 = Plaud transcripts (meeting insights)
  -- 3 = Sent emails (Austin's own communications)
  -- 4 = Inbox (general, lowest priority)
  priority INT DEFAULT 4,
  
  -- Processing Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  assigned_agent TEXT,                   -- Which agent is working on it
  retry_count INT DEFAULT 0,
  
  -- Error tracking
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for queue management
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_queue_agent ON processing_queue(assigned_agent, status);

-- ============================================
-- Processing Stats (for monitoring dashboard)
-- ============================================

CREATE TABLE IF NOT EXISTS processing_stats (
  id BIGSERIAL PRIMARY KEY,
  
  -- Counts
  total_threads INT DEFAULT 0,
  processed_threads INT DEFAULT 0,
  failed_threads INT DEFAULT 0,
  pending_threads INT DEFAULT 0,
  
  -- Quality metrics
  avg_quality_score DECIMAL(4,2),
  low_confidence_count INT DEFAULT 0,
  
  -- Cost tracking
  total_cost_usd DECIMAL(10,4),
  
  -- Rate
  threads_per_minute DECIMAL(6,2),
  
  -- Timestamps
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS Policies
-- ============================================

-- Contact Profiles
ALTER TABLE contact_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts" ON contact_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage contacts" ON contact_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage contacts" ON contact_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Knowledge Embeddings
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can search knowledge" ON knowledge_embeddings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage embeddings" ON knowledge_embeddings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Processing Log
ALTER TABLE email_processing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view processing log" ON email_processing_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage processing log" ON email_processing_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Processing Queue
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view queue" ON processing_queue
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage queue" ON processing_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Processing Stats
ALTER TABLE processing_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stats" ON processing_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage stats" ON processing_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- Helper Functions
-- ============================================

-- Semantic search function
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  project_id text,
  thread_id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.project_id,
    ke.thread_id,
    ke.content,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Get processing progress
CREATE OR REPLACE FUNCTION get_processing_progress()
RETURNS TABLE (
  total_count bigint,
  processed_count bigint,
  failed_count bigint,
  pending_count bigint,
  percent_complete numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_count,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint AS processed_count,
    COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending_count,
    ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS percent_complete
  FROM processing_queue;
END;
$$;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE contact_profiles IS 'Unified contact database with full context from email interactions';
COMMENT ON TABLE knowledge_embeddings IS 'Vector embeddings for semantic search across all project knowledge';
COMMENT ON TABLE email_processing_log IS 'Audit log of all processed emails with quality scores';
COMMENT ON TABLE processing_queue IS 'Queue for parallel email backfill processing';
COMMENT ON TABLE processing_stats IS 'Time-series snapshots of processing progress for dashboard';
