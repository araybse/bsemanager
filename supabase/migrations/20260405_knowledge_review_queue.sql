-- Knowledge Review Queue
-- Tracks AI-extracted knowledge entries that need human review

CREATE TABLE knowledge_review_queue (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL UNIQUE,
  file_project TEXT NOT NULL,           -- Project file where thread is stored (e.g., "23-01")
  suggested_project TEXT,               -- AI-suggested correct project (from crossProjectReferences)
  subject TEXT,
  preview TEXT,                         -- First ~200 chars of summary
  processed_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reassigned', 'deleted')),
  issue_type TEXT DEFAULT 'misfiled' CHECK (issue_type IN ('misfiled', 'ambiguous', 'needs_review')),
  assigned_by TEXT DEFAULT 'ai',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  final_project TEXT,                   -- Where it ended up after review
  metadata JSONB,                       -- Full thread data for reference
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_review_queue_status ON knowledge_review_queue(status);
CREATE INDEX idx_review_queue_file_project ON knowledge_review_queue(file_project);
CREATE INDEX idx_review_queue_created_at ON knowledge_review_queue(created_at);

-- RLS policies
ALTER TABLE knowledge_review_queue ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admin can view all review queue items"
  ON knowledge_review_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert review queue items"
  ON knowledge_review_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can update review queue items"
  ON knowledge_review_queue FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Service role can do everything (for backfill script)
CREATE POLICY "Service role can manage review queue"
  ON knowledge_review_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE knowledge_review_queue IS 'Queue for reviewing AI-extracted knowledge entries that may be misfiled or need verification';
