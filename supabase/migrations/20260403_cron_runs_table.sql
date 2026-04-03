-- Create cron_runs table to track automated job executions
CREATE TABLE IF NOT EXISTS cron_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent runs
CREATE INDEX idx_cron_runs_job_created ON cron_runs(job_name, created_at DESC);

-- RLS: Only admins can view cron run logs
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cron runs"
  ON cron_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE cron_runs IS 'Tracks automated cron job executions (QB sync, data quality, etc.)';
COMMENT ON COLUMN cron_runs.job_name IS 'Name of the cron job (e.g., qb-sync, data-quality-run)';
COMMENT ON COLUMN cron_runs.status IS 'Execution status: success, failed, or partial';
COMMENT ON COLUMN cron_runs.results IS 'JSON results from the job execution';
