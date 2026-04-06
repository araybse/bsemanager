-- Auto-Processor State Tracking
-- Logs heartbeat checks from the email auto-processor for dashboard monitoring

CREATE TABLE IF NOT EXISTS auto_processor_state (
  id BIGSERIAL PRIMARY KEY,
  last_check TIMESTAMPTZ NOT NULL,
  processed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE auto_processor_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view auto processor state"
  ON auto_processor_state
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role can manage auto processor state"
  ON auto_processor_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for quick latest-check lookups
CREATE INDEX IF NOT EXISTS idx_auto_processor_state_last_check 
  ON auto_processor_state(last_check DESC);

COMMENT ON TABLE auto_processor_state IS 'Heartbeat logs from email auto-processor for dashboard health monitoring';
