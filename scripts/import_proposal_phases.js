require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importProposalPhases() {
  // Load phase data
  const phaseData = JSON.parse(fs.readFileSync('scripts/all_proposal_phases.json', 'utf-8'));
  
  // Get all proposals to map proposal_number to id
  const { data: proposals, error: propError } = await supabase
    .from('proposals')
    .select('id, proposal_number');
  
  if (propError) {
    console.error('Error fetching proposals:', propError);
    return;
  }
  
  const proposalMap = {};
  proposals.forEach(p => {
    proposalMap[p.proposal_number] = p.id;
  });
  
  console.log(`Found ${proposals.length} proposals`);
  
  // Build phase records
  const phases = [];
  let unmapped = [];
  
  for (const proposal of phaseData) {
    const proposalId = proposalMap[proposal.proposal_number];
    if (!proposalId) {
      unmapped.push(proposal.proposal_number);
      continue;
    }
    
    for (const phase of proposal.phases) {
      phases.push({
        proposal_id: proposalId,
        phase_code: phase.code,
        phase_name: phase.name,
        amount: phase.amount,
        billing_type: phase.billing_type
      });
    }
  }
  
  console.log(`Built ${phases.length} phase records`);
  if (unmapped.length > 0) {
    console.log(`Unmapped proposals: ${unmapped.join(', ')}`);
  }
  
  // Check if proposal_phases table exists by trying to select from it
  const { error: checkError } = await supabase
    .from('proposal_phases')
    .select('id')
    .limit(1);
  
  if (checkError && checkError.code === '42P01') {
    console.log('Table proposal_phases does not exist. Please create it first with:');
    console.log(`
CREATE TABLE proposal_phases (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  phase_code VARCHAR(10) NOT NULL,
  phase_name VARCHAR(200) NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_type VARCHAR(1) NOT NULL DEFAULT 'L',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposal_phases_proposal_id ON proposal_phases(proposal_id);
`);
    return;
  }
  
  // Clear existing phases
  console.log('Clearing existing phases...');
  const { error: deleteError } = await supabase
    .from('proposal_phases')
    .delete()
    .gte('id', 0);
  
  if (deleteError) {
    console.error('Error clearing phases:', deleteError);
    return;
  }
  
  // Insert phases in batches
  const batchSize = 100;
  for (let i = 0; i < phases.length; i += batchSize) {
    const batch = phases.slice(i, i + batchSize);
    const { error } = await supabase.from('proposal_phases').insert(batch);
    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
    } else {
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} phases`);
    }
  }
  
  // Verify
  const { data: count } = await supabase.from('proposal_phases').select('id', { count: 'exact' });
  console.log(`Total phases in database: ${count?.length}`);
}

importProposalPhases().catch(console.error);
