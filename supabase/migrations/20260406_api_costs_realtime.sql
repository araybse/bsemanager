-- Real-time API cost tracking table
-- Created: 2026-04-06
-- Purpose: Log every OpenClaw session's token usage for real-time cost monitoring

CREATE TABLE IF NOT EXISTS api_costs_realtime (
  id BIGSERIAL PRIMARY KEY,
  session_key TEXT NOT NULL,
  session_type TEXT, -- 'main', 'subagent'
  agent_name TEXT, -- 'Max', 'Sebastian', 'Olivia', etc.
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(10,4) NOT NULL,
  session_duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  usage_date DATE NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_api_costs_realtime_date ON api_costs_realtime(usage_date);
CREATE INDEX idx_api_costs_realtime_model ON api_costs_realtime(model);
CREATE INDEX idx_api_costs_realtime_agent ON api_costs_realtime(agent_name);
CREATE INDEX idx_api_costs_realtime_session ON api_costs_realtime(session_key);
CREATE INDEX idx_api_costs_realtime_created ON api_costs_realtime(created_at);

-- RLS policies (admin access only)
ALTER TABLE api_costs_realtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view api_costs_realtime" ON api_costs_realtime
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can insert api_costs_realtime" ON api_costs_realtime
  FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON api_costs_realtime TO authenticated;
GRANT INSERT ON api_costs_realtime TO service_role;
