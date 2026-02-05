require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTable() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS proposal_phases (
        id SERIAL PRIMARY KEY,
        proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
        phase_code VARCHAR(10) NOT NULL,
        phase_name VARCHAR(200) NOT NULL,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        billing_type VARCHAR(1) NOT NULL DEFAULT 'L',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_proposal_phases_proposal_id ON proposal_phases(proposal_id);
    `
  });
  
  if (error) {
    console.error('Error creating table via RPC:', error);
    console.log('You may need to create the table manually in Supabase SQL Editor.');
    return false;
  }
  
  console.log('Table created successfully!');
  return true;
}

createTable().catch(console.error);
