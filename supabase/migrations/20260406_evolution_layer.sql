-- Evolution Layer (Layer 6) - Human Feedback Loop + Learning System
-- This enables IRIS to learn from corrections and improve over time

-- ============================================
-- 1. Memory Corrections Table
-- ============================================
-- Captures human corrections to AI extractions

CREATE TABLE IF NOT EXISTS memory_corrections (
  id BIGSERIAL PRIMARY KEY,
  
  -- Memory reference
  memory_id UUID NOT NULL,               -- From cognitive_memories table
  memory_version INTEGER NOT NULL DEFAULT 1,
  thread_id TEXT,                        -- Email thread reference
  
  -- Correction type
  correction_type TEXT NOT NULL CHECK (correction_type IN (
    'entity_added',                      -- Human added missing entity
    'entity_removed',                    -- Human removed incorrect entity
    'entity_fixed',                      -- Human corrected entity details
    'relationship_added',                -- Human added missing relationship
    'relationship_removed',              -- Human removed incorrect relationship
    'relationship_fixed',                -- Human corrected relationship
    'action_added',                      -- Human added missed action item
    'action_removed',                    -- Human removed false action item
    'action_fixed',                      -- Human fixed action details
    'project_reassigned',                -- Human changed project assignment
    'narrative_fixed',                   -- Human corrected the summary
    'confidence_override',               -- Human overrode confidence scores
    'quality_override'                   -- Human overrode quality assessment
  )),
  
  -- Before/After values
  before_value JSONB NOT NULL,
  after_value JSONB NOT NULL,
  
  -- Correction context
  corrected_by TEXT NOT NULL,            -- User email or 'system'
  correction_reason TEXT,                -- Why the correction was needed
  field_path TEXT,                       -- JSON path to the corrected field
  
  -- Learning generated
  learning_generated JSONB,              -- Pattern/learning created from this
  applied_to_future BOOLEAN DEFAULT FALSE,
  
  -- Source context (for learning)
  source_email_from TEXT,                -- Email sender
  source_email_subject TEXT,             -- Email subject
  source_project TEXT,                   -- Project number
  
  -- Timestamps
  corrected_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_before_after CHECK (before_value IS DISTINCT FROM after_value)
);

CREATE INDEX idx_corrections_memory ON memory_corrections(memory_id);
CREATE INDEX idx_corrections_type ON memory_corrections(correction_type);
CREATE INDEX idx_corrections_time ON memory_corrections(corrected_at DESC);
CREATE INDEX idx_corrections_project ON memory_corrections(source_project);
CREATE INDEX idx_corrections_unapplied ON memory_corrections(applied_to_future) WHERE applied_to_future = FALSE;

-- ============================================
-- 2. Evolution Learnings Table
-- ============================================
-- Stores patterns learned from corrections

CREATE TABLE IF NOT EXISTS evolution_learnings (
  id BIGSERIAL PRIMARY KEY,
  
  -- Pattern description
  pattern TEXT NOT NULL,                 -- Human-readable pattern description
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'entity_rule',                       -- "Always extract X as entity type Y"
    'relationship_rule',                 -- "When X, then relationship Y exists"
    'sender_pattern',                    -- "Emails from X involve Y"
    'keyword_pattern',                   -- "Keywords X indicate Y"
    'project_pattern',                   -- "When X, assign to project Y"
    'confidence_pattern',                -- "Boost confidence for X in context Y"
    'negative_pattern'                   -- "Never extract X as Y"
  )),
  
  -- Rule details (machine-readable)
  rule_condition JSONB,                  -- Conditions for when this applies
  rule_action JSONB,                     -- What to do when conditions match
  
  -- Application scope
  applies_to TEXT NOT NULL CHECK (applies_to IN (
    'entity_extraction',
    'relationship_detection',
    'action_capture',
    'project_assignment',
    'confidence_scoring',
    'quality_assessment'
  )),
  
  -- Learning confidence
  confidence_boost DECIMAL(3,2) DEFAULT 0.10,  -- How much to boost confidence
  
  -- Validation tracking
  times_validated INTEGER DEFAULT 0,     -- Confirmations of this pattern
  times_failed INTEGER DEFAULT 0,        -- Times pattern was wrong
  
  -- Source corrections
  learned_from BIGINT[] DEFAULT '{}',    -- Array of correction IDs
  
  -- Status
  active BOOLEAN DEFAULT true,           -- Is this pattern active?
  auto_apply BOOLEAN DEFAULT false,      -- Should this apply automatically?
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_validated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ
);

CREATE INDEX idx_learnings_pattern ON evolution_learnings(pattern);
CREATE INDEX idx_learnings_type ON evolution_learnings(pattern_type);
CREATE INDEX idx_learnings_applies ON evolution_learnings(applies_to);
CREATE INDEX idx_learnings_active ON evolution_learnings(active) WHERE active = TRUE;
CREATE INDEX idx_learnings_auto ON evolution_learnings(auto_apply) WHERE auto_apply = TRUE;

-- ============================================
-- 3. Knowledge Review Queue (Enhanced)
-- ============================================
-- For memories flagged by Reflector that need human review

CREATE TABLE IF NOT EXISTS cognitive_review_queue (
  id BIGSERIAL PRIMARY KEY,
  
  -- Memory reference
  memory_id UUID NOT NULL,
  thread_id TEXT NOT NULL,
  
  -- Original extraction
  original_extraction JSONB NOT NULL,    -- Full memory JSON
  
  -- Quality info
  quality_score DECIMAL(4,2),            -- 0.00-10.00
  confidence DECIMAL(3,2),               -- 0.00-1.00
  
  -- Flag reason
  flag_reason TEXT NOT NULL,
  flags TEXT[] DEFAULT '{}',             -- Array of flag types
  
  -- Source preview
  source_subject TEXT,
  source_from TEXT,
  source_date TIMESTAMPTZ,
  source_preview TEXT,                   -- First 500 chars of email
  source_project TEXT,
  
  -- Review status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'edited',
    'rejected',
    're_extracted'
  )),
  
  -- Review outcome
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  corrections_made INTEGER DEFAULT 0,    -- Count of corrections from this review
  
  -- Timestamps
  flagged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_queue_status ON cognitive_review_queue(status);
CREATE INDEX idx_review_queue_quality ON cognitive_review_queue(quality_score);
CREATE INDEX idx_review_queue_pending ON cognitive_review_queue(status, flagged_at) WHERE status = 'pending';
CREATE INDEX idx_review_queue_thread ON cognitive_review_queue(thread_id);

-- ============================================
-- 4. Learning Application Log
-- ============================================
-- Tracks when learnings are applied to new extractions

CREATE TABLE IF NOT EXISTS learning_application_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Learning reference
  learning_id BIGINT REFERENCES evolution_learnings(id) ON DELETE SET NULL,
  
  -- Memory it was applied to
  memory_id UUID NOT NULL,
  thread_id TEXT,
  
  -- Application details
  field_affected TEXT,                   -- Which field was affected
  original_value JSONB,                  -- Value before learning applied
  adjusted_value JSONB,                  -- Value after learning applied
  confidence_change DECIMAL(3,2),        -- Change in confidence (can be negative)
  
  -- Validation
  validated BOOLEAN,                     -- Was this application correct?
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  
  -- Timestamp
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_learning ON learning_application_log(learning_id);
CREATE INDEX idx_application_memory ON learning_application_log(memory_id);
CREATE INDEX idx_application_unvalidated ON learning_application_log(validated) WHERE validated IS NULL;

-- ============================================
-- 5. Pattern Aggregation Summary
-- ============================================
-- Stores aggregated patterns from corrections

CREATE TABLE IF NOT EXISTS pattern_aggregation (
  id BIGSERIAL PRIMARY KEY,
  
  -- Pattern summary
  pattern_summary TEXT NOT NULL,
  correction_type TEXT NOT NULL,
  
  -- Statistics
  occurrence_count INTEGER DEFAULT 0,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  
  -- Affected items
  affected_projects TEXT[] DEFAULT '{}',
  affected_senders TEXT[] DEFAULT '{}',
  
  -- Generated learning
  generated_learning_id BIGINT REFERENCES evolution_learnings(id),
  
  -- Status
  requires_attention BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pattern_agg_type ON pattern_aggregation(correction_type);
CREATE INDEX idx_pattern_agg_attention ON pattern_aggregation(requires_attention) WHERE requires_attention = TRUE;

-- ============================================
-- Helper Functions
-- ============================================

-- Record a correction and update memory version
CREATE OR REPLACE FUNCTION record_correction(
  p_memory_id UUID,
  p_thread_id TEXT,
  p_correction_type TEXT,
  p_before_value JSONB,
  p_after_value JSONB,
  p_corrected_by TEXT,
  p_reason TEXT DEFAULT NULL,
  p_field_path TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_correction_id BIGINT;
  v_current_version INTEGER;
BEGIN
  -- Get current version
  SELECT COALESCE(MAX(memory_version), 0) + 1 INTO v_current_version
  FROM memory_corrections
  WHERE memory_id = p_memory_id;
  
  -- Insert correction
  INSERT INTO memory_corrections (
    memory_id,
    memory_version,
    thread_id,
    correction_type,
    before_value,
    after_value,
    corrected_by,
    correction_reason,
    field_path
  ) VALUES (
    p_memory_id,
    v_current_version,
    p_thread_id,
    p_correction_type,
    p_before_value,
    p_after_value,
    p_corrected_by,
    p_reason,
    p_field_path
  )
  RETURNING id INTO v_correction_id;
  
  -- Log to evolution_log for dashboard
  INSERT INTO evolution_log (
    correction_type,
    description,
    before_value,
    after_value,
    source_thread,
    corrected_by,
    impact_score
  ) VALUES (
    'human_feedback',
    COALESCE(p_reason, 'Correction: ' || p_correction_type),
    p_before_value,
    p_after_value,
    p_thread_id,
    p_corrected_by,
    0.5 -- Default impact, updated later based on learning success
  );
  
  RETURN v_correction_id;
END;
$$;

-- Get active learnings for extraction
CREATE OR REPLACE FUNCTION get_active_learnings(
  p_applies_to TEXT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  pattern TEXT,
  pattern_type TEXT,
  rule_condition JSONB,
  rule_action JSONB,
  confidence_boost DECIMAL(3,2),
  times_validated INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.id,
    el.pattern,
    el.pattern_type,
    el.rule_condition,
    el.rule_action,
    el.confidence_boost,
    el.times_validated
  FROM evolution_learnings el
  WHERE el.active = TRUE
    AND (p_applies_to IS NULL OR el.applies_to = p_applies_to)
  ORDER BY el.times_validated DESC, el.confidence_boost DESC;
END;
$$;

-- Increment learning validation
CREATE OR REPLACE FUNCTION validate_learning(
  p_learning_id BIGINT,
  p_success BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_success THEN
    UPDATE evolution_learnings
    SET 
      times_validated = times_validated + 1,
      last_validated_at = NOW(),
      -- Auto-enable if validated enough times
      auto_apply = CASE WHEN times_validated >= 5 AND times_failed = 0 THEN TRUE ELSE auto_apply END
    WHERE id = p_learning_id;
  ELSE
    UPDATE evolution_learnings
    SET 
      times_failed = times_failed + 1,
      -- Deactivate if too many failures
      active = CASE WHEN times_failed >= 3 THEN FALSE ELSE active END,
      deactivated_at = CASE WHEN times_failed >= 3 THEN NOW() ELSE deactivated_at END
    WHERE id = p_learning_id;
  END IF;
END;
$$;

-- Get correction statistics for dashboard
CREATE OR REPLACE FUNCTION get_correction_stats()
RETURNS TABLE (
  total_corrections BIGINT,
  by_type JSONB,
  recent_24h BIGINT,
  recent_7d BIGINT,
  top_correction_types JSONB,
  pending_reviews BIGINT,
  active_learnings BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH type_counts AS (
    SELECT 
      correction_type,
      COUNT(*) as cnt
    FROM memory_corrections
    GROUP BY correction_type
  ),
  top_types AS (
    SELECT jsonb_agg(jsonb_build_object(
      'type', correction_type,
      'count', cnt
    ) ORDER BY cnt DESC) as top
    FROM type_counts
    LIMIT 5
  )
  SELECT
    (SELECT COUNT(*) FROM memory_corrections),
    (SELECT jsonb_object_agg(correction_type, cnt) FROM type_counts),
    (SELECT COUNT(*) FROM memory_corrections WHERE corrected_at > NOW() - INTERVAL '24 hours'),
    (SELECT COUNT(*) FROM memory_corrections WHERE corrected_at > NOW() - INTERVAL '7 days'),
    (SELECT top FROM top_types),
    (SELECT COUNT(*) FROM cognitive_review_queue WHERE status = 'pending'),
    (SELECT COUNT(*) FROM evolution_learnings WHERE active = TRUE);
END;
$$;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE memory_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_application_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_aggregation ENABLE ROW LEVEL SECURITY;

-- Memory Corrections
CREATE POLICY "Admin can view corrections" ON memory_corrections
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admin can insert corrections" ON memory_corrections
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Service role full access corrections" ON memory_corrections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Evolution Learnings
CREATE POLICY "Admin can view learnings" ON evolution_learnings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Service role full access learnings" ON evolution_learnings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cognitive Review Queue
CREATE POLICY "Admin can view review queue" ON cognitive_review_queue
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admin can update review queue" ON cognitive_review_queue
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Service role full access review queue" ON cognitive_review_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Learning Application Log
CREATE POLICY "Admin can view application log" ON learning_application_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Service role full access application log" ON learning_application_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Pattern Aggregation
CREATE POLICY "Admin can view patterns" ON pattern_aggregation
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Service role full access patterns" ON pattern_aggregation
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE memory_corrections IS 'Human corrections to AI extractions - core of the evolution system';
COMMENT ON TABLE evolution_learnings IS 'Patterns learned from corrections that improve future extractions';
COMMENT ON TABLE cognitive_review_queue IS 'Memories flagged for human review by the Reflector';
COMMENT ON TABLE learning_application_log IS 'Tracks when learnings are applied to new extractions';
COMMENT ON TABLE pattern_aggregation IS 'Aggregated patterns from multiple corrections';
