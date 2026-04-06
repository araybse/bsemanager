-- Cognitive Loop Dashboard Monitoring System
-- Comprehensive monitoring for auto-processor health, quality, coverage, graph stats, and evolution

-- ============================================
-- 1. Cognitive Loop Health (Heartbeat Logs)
-- ============================================
-- Extends auto_processor_state with more detailed health metrics

CREATE TABLE IF NOT EXISTS cognitive_loop_health (
  id BIGSERIAL PRIMARY KEY,
  
  -- Timestamp
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('running', 'stopped', 'error', 'degraded')),
  
  -- Processing metrics
  processing_rate DECIMAL(8,2),          -- emails/hour
  error_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  
  -- Resource usage
  memory_mb INTEGER,
  cpu_percent DECIMAL(5,2),
  
  -- Last error (if any)
  last_error TEXT,
  
  -- Metadata
  metadata JSONB,                        -- Additional context
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cognitive_health_heartbeat ON cognitive_loop_health(heartbeat_at DESC);
CREATE INDEX idx_cognitive_health_status ON cognitive_loop_health(status);

-- ============================================
-- 2. Extraction Quality Log
-- ============================================
-- Detailed quality tracking per extraction dimension

CREATE TABLE IF NOT EXISTS extraction_quality_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Reference
  thread_id TEXT NOT NULL,
  processing_log_id BIGINT REFERENCES email_processing_log(id) ON DELETE CASCADE,
  
  -- Overall quality
  overall_score DECIMAL(4,2) NOT NULL,   -- 0.00-10.00
  
  -- Dimension scores
  entity_score DECIMAL(4,2),             -- Quality of entity extraction
  relationship_score DECIMAL(4,2),       -- Quality of relationship mapping
  action_score DECIMAL(4,2),             -- Quality of action/commitment extraction
  narrative_score DECIMAL(4,2),          -- Quality of narrative understanding
  
  -- Flags
  needs_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  
  -- Timestamps
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extraction_quality_thread ON extraction_quality_log(thread_id);
CREATE INDEX idx_extraction_quality_score ON extraction_quality_log(overall_score);
CREATE INDEX idx_extraction_quality_review ON extraction_quality_log(needs_review) WHERE needs_review = TRUE;
CREATE INDEX idx_extraction_quality_time ON extraction_quality_log(extracted_at DESC);

-- ============================================
-- 3. Entity Statistics
-- ============================================
-- Tracks entity counts and graph metrics over time

CREATE TABLE IF NOT EXISTS entity_stats (
  id BIGSERIAL PRIMARY KEY,
  
  -- Snapshot time
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Entity counts by type
  person_count INTEGER DEFAULT 0,
  company_count INTEGER DEFAULT 0,
  project_count INTEGER DEFAULT 0,
  location_count INTEGER DEFAULT 0,
  topic_count INTEGER DEFAULT 0,
  
  -- Relationship metrics
  total_relationships INTEGER DEFAULT 0,
  relationship_types JSONB,              -- Count by relationship type
  
  -- Graph metrics
  graph_density DECIMAL(6,4),            -- edges / (nodes * (nodes-1))
  avg_connections DECIMAL(6,2),          -- avg edges per node
  isolated_nodes INTEGER DEFAULT 0,      -- nodes with no edges
  
  -- Top entities (most connected)
  top_entities JSONB,                    -- [{name, type, connection_count}]
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entity_stats_snapshot ON entity_stats(snapshot_at DESC);

-- ============================================
-- 4. Reflection Log
-- ============================================
-- Logs from the Reflector when it identifies patterns or issues

CREATE TABLE IF NOT EXISTS reflection_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Reflection metadata
  reflection_type TEXT NOT NULL CHECK (reflection_type IN (
    'pattern_detected',
    'quality_issue',
    'inconsistency',
    'missing_data',
    'improvement_suggestion'
  )),
  
  -- Content
  finding TEXT NOT NULL,
  confidence DECIMAL(3,2),
  
  -- Context
  affected_threads TEXT[],
  affected_entities TEXT[],
  
  -- Severity
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Action taken
  action_taken TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_reflection_type ON reflection_log(reflection_type);
CREATE INDEX idx_reflection_severity ON reflection_log(severity);
CREATE INDEX idx_reflection_unresolved ON reflection_log(resolved) WHERE resolved = FALSE;
CREATE INDEX idx_reflection_time ON reflection_log(detected_at DESC);

-- ============================================
-- 5. Evolution Log (Learning/Corrections)
-- ============================================
-- Tracks corrections and how the system learns over time

CREATE TABLE IF NOT EXISTS evolution_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Correction type
  correction_type TEXT NOT NULL CHECK (correction_type IN (
    'human_feedback',
    'self_correction',
    'pattern_learned',
    'rule_added'
  )),
  
  -- Content
  description TEXT NOT NULL,
  
  -- Before/After
  before_value JSONB,
  after_value JSONB,
  
  -- Source
  source_thread TEXT,
  corrected_by TEXT,                     -- User ID or 'system'
  
  -- Impact
  impact_score DECIMAL(3,2),             -- How much this improved things (0.00-1.00)
  affected_extractions INTEGER DEFAULT 0,
  
  -- Timestamps
  corrected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evolution_type ON evolution_log(correction_type);
CREATE INDEX idx_evolution_time ON evolution_log(corrected_at DESC);
CREATE INDEX idx_evolution_source ON evolution_log(source_thread);

-- ============================================
-- 6. Processing Coverage Gaps
-- ============================================
-- Tracks time periods where processing missed emails

CREATE TABLE IF NOT EXISTS processing_coverage_gaps (
  id BIGSERIAL PRIMARY KEY,
  
  -- Gap period
  gap_start TIMESTAMPTZ NOT NULL,
  gap_end TIMESTAMPTZ NOT NULL,
  
  -- Impact
  emails_missed INTEGER DEFAULT 0,
  
  -- Reason
  reason TEXT,
  
  -- Status
  backfilled BOOLEAN DEFAULT FALSE,
  backfilled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coverage_gaps_period ON processing_coverage_gaps(gap_start, gap_end);
CREATE INDEX idx_coverage_gaps_unresolved ON processing_coverage_gaps(backfilled) WHERE backfilled = FALSE;

-- ============================================
-- Helper Functions
-- ============================================

-- Get current system health
CREATE OR REPLACE FUNCTION get_cognitive_loop_health()
RETURNS TABLE (
  status TEXT,
  uptime_hours NUMERIC,
  last_heartbeat TIMESTAMPTZ,
  error_count BIGINT,
  processing_rate NUMERIC,
  health_score NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT * FROM cognitive_loop_health
    ORDER BY heartbeat_at DESC
    LIMIT 1
  ),
  last_24h AS (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'error') as errors,
      AVG(processing_rate) as avg_rate
    FROM cognitive_loop_health
    WHERE heartbeat_at > NOW() - INTERVAL '24 hours'
  )
  SELECT
    latest.status,
    EXTRACT(EPOCH FROM (NOW() - latest.heartbeat_at)) / 3600 as uptime_hours,
    latest.heartbeat_at,
    last_24h.errors,
    last_24h.avg_rate,
    CASE 
      WHEN latest.status = 'running' THEN 100.0
      WHEN latest.status = 'degraded' THEN 70.0
      WHEN latest.status = 'error' THEN 30.0
      ELSE 0.0
    END as health_score
  FROM latest, last_24h;
END;
$$;

-- Get quality metrics summary
CREATE OR REPLACE FUNCTION get_quality_metrics()
RETURNS TABLE (
  avg_overall NUMERIC,
  avg_entity NUMERIC,
  avg_relationship NUMERIC,
  avg_action NUMERIC,
  avg_narrative NUMERIC,
  high_quality_pct NUMERIC,
  needs_review_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(overall_score), 2) as avg_overall,
    ROUND(AVG(entity_score), 2) as avg_entity,
    ROUND(AVG(relationship_score), 2) as avg_relationship,
    ROUND(AVG(action_score), 2) as avg_action,
    ROUND(AVG(narrative_score), 2) as avg_narrative,
    ROUND(COUNT(*) FILTER (WHERE overall_score >= 8.0)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as high_quality_pct,
    COUNT(*) FILTER (WHERE needs_review = TRUE) as needs_review_count
  FROM extraction_quality_log
  WHERE extracted_at > NOW() - INTERVAL '30 days';
END;
$$;

-- Get processing coverage
CREATE OR REPLACE FUNCTION get_processing_coverage()
RETURNS TABLE (
  total_processed BIGINT,
  backlog_size BIGINT,
  success_rate NUMERIC,
  gaps_count BIGINT,
  oldest_unprocessed TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'processed') as processed,
      COUNT(*) FILTER (WHERE status IN ('pending', 'failed')) as backlog,
      COUNT(*) as total
    FROM email_processing_log
  ),
  gaps AS (
    SELECT COUNT(*) as gap_count
    FROM processing_coverage_gaps
    WHERE backfilled = FALSE
  ),
  oldest AS (
    SELECT MIN(date) as oldest_date
    FROM email_processing_log
    WHERE status = 'pending'
  )
  SELECT
    stats.processed,
    stats.backlog,
    ROUND(stats.processed::NUMERIC / NULLIF(stats.total, 0) * 100, 2) as success_rate,
    gaps.gap_count,
    oldest.oldest_date
  FROM stats, gaps, oldest;
END;
$$;

-- Get learning rate (errors decreasing over time)
CREATE OR REPLACE FUNCTION get_learning_rate()
RETURNS TABLE (
  week_number INTEGER,
  error_count BIGINT,
  correction_count BIGINT,
  improvement_pct NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH weekly_errors AS (
    SELECT
      EXTRACT(WEEK FROM extracted_at)::INTEGER as week,
      COUNT(*) FILTER (WHERE needs_review = TRUE) as errors
    FROM extraction_quality_log
    WHERE extracted_at > NOW() - INTERVAL '12 weeks'
    GROUP BY week
    ORDER BY week
  ),
  weekly_corrections AS (
    SELECT
      EXTRACT(WEEK FROM corrected_at)::INTEGER as week,
      COUNT(*) as corrections
    FROM evolution_log
    WHERE corrected_at > NOW() - INTERVAL '12 weeks'
    GROUP BY week
  )
  SELECT
    we.week,
    we.errors,
    COALESCE(wc.corrections, 0) as corrections,
    CASE 
      WHEN LAG(we.errors) OVER (ORDER BY we.week) IS NOT NULL 
      THEN ROUND((LAG(we.errors) OVER (ORDER BY we.week) - we.errors)::NUMERIC / 
                 NULLIF(LAG(we.errors) OVER (ORDER BY we.week), 0) * 100, 2)
      ELSE 0
    END as improvement_pct
  FROM weekly_errors we
  LEFT JOIN weekly_corrections wc ON we.week = wc.week
  ORDER BY we.week DESC
  LIMIT 12;
END;
$$;

-- ============================================
-- RLS Policies
-- ============================================

-- Cognitive Loop Health
ALTER TABLE cognitive_loop_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view cognitive health" ON cognitive_loop_health
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage cognitive health" ON cognitive_loop_health
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Extraction Quality Log
ALTER TABLE extraction_quality_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view quality log" ON extraction_quality_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage quality log" ON extraction_quality_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Entity Stats
ALTER TABLE entity_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view entity stats" ON entity_stats
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage entity stats" ON entity_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reflection Log
ALTER TABLE reflection_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view reflections" ON reflection_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage reflections" ON reflection_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Evolution Log
ALTER TABLE evolution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view evolution log" ON evolution_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage evolution log" ON evolution_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Processing Coverage Gaps
ALTER TABLE processing_coverage_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view coverage gaps" ON processing_coverage_gaps
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage coverage gaps" ON processing_coverage_gaps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE cognitive_loop_health IS 'Heartbeat logs for auto-processor health monitoring';
COMMENT ON TABLE extraction_quality_log IS 'Detailed quality tracking per extraction with dimension scores';
COMMENT ON TABLE entity_stats IS 'Snapshot of entity counts and graph metrics over time';
COMMENT ON TABLE reflection_log IS 'Pattern detection and issues identified by Reflector';
COMMENT ON TABLE evolution_log IS 'Learning history - corrections and improvements over time';
COMMENT ON TABLE processing_coverage_gaps IS 'Time periods where email processing missed messages';
