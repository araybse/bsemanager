-- Create API cost logging table
CREATE TABLE IF NOT EXISTS api_cost_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cost_usd DECIMAL(10, 6) NOT NULL,
  category TEXT NOT NULL, -- e.g., 'llm', 'tts', 'stt', 'vision', 'embedding'
  project TEXT, -- Optional project identifier
  model TEXT, -- Model name (e.g., 'gpt-4', 'claude-sonnet-4')
  input_tokens INTEGER, -- Input tokens used
  output_tokens INTEGER, -- Output tokens used
  endpoint TEXT, -- API endpoint called
  metadata JSONB, -- Additional metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_api_cost_log_timestamp ON api_cost_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_cost_log_category ON api_cost_log(category);
CREATE INDEX IF NOT EXISTS idx_api_cost_log_project ON api_cost_log(project) WHERE project IS NOT NULL;

-- Add RLS policies
ALTER TABLE api_cost_log ENABLE ROW LEVEL SECURITY;

-- Admin users can view all cost logs
CREATE POLICY "Admin users can view API costs"
  ON api_cost_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow system/service to insert cost logs
CREATE POLICY "Allow service to insert API costs"
  ON api_cost_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE api_cost_log IS 'Logs API costs for monitoring and budget tracking';
