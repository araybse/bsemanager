import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://ahpsnajqjosjasaqebpd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocHNuYWpxam9zamFzYXFlYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgyNTM3OCwiZXhwIjoyMDU1NDAxMzc4fQ.R2jksPGT8r6mGwUnuXtVXZOvbvbDvIDrHE4xWKKB8KE';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE TABLE IF NOT EXISTS cash_flow_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month VARCHAR(7) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month)
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_distributions_month ON cash_flow_distributions(month);

ALTER TABLE cash_flow_distributions ENABLE ROW LEVEL SECURITY;
`;

const { data, error } = await supabase.rpc('exec', { sql });

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ cash_flow_distributions table created successfully!');
}
