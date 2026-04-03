-- Cash Flow Distributions Table
-- Tracks planned owner distributions (dividends, draws) by month

CREATE TABLE IF NOT EXISTS cash_flow_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month VARCHAR(7) NOT NULL, -- YYYY-MM format
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month)
);

-- Index for fast month lookups
CREATE INDEX IF NOT EXISTS idx_cash_flow_distributions_month ON cash_flow_distributions(month);

-- RLS Policies
ALTER TABLE cash_flow_distributions ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access to cash_flow_distributions"
  ON cash_flow_distributions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.email = auth.jwt() ->> 'email'
      AND employees.role = 'admin'
    )
  );

-- PM can view
CREATE POLICY "PM can view cash_flow_distributions"
  ON cash_flow_distributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.email = auth.jwt() ->> 'email'
      AND employees.role IN ('admin', 'pm')
    )
  );

COMMENT ON TABLE cash_flow_distributions IS 'Manual forecasts for owner distributions by month';
COMMENT ON COLUMN cash_flow_distributions.month IS 'Month in YYYY-MM format';
COMMENT ON COLUMN cash_flow_distributions.amount IS 'Planned distribution amount (negative reduces cash)';
