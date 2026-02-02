const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPhases() {
  const { data: phases } = await supabase
    .from('contract_phases')
    .select('id, project_id, phase_code, phase_name, billing_type, total_fee')
    .order('project_id')
    .limit(50);

  console.log('=== Current Contract Phases in Database ===\n');
  phases?.forEach(p => {
    console.log(`Project ${p.project_id} | Code: ${p.phase_code} | Name: ${p.phase_name} | Type: ${p.billing_type} | Fee: $${p.total_fee}`);
  });

  // Count unique phase codes
  const { data: allPhases } = await supabase
    .from('contract_phases')
    .select('phase_code');

  const codes = new Set(allPhases?.map(p => p.phase_code));
  console.log('\n=== Unique Phase Codes ===');
  console.log(Array.from(codes).sort().join(', '));

  const { count } = await supabase.from('contract_phases').select('*', { count: 'exact', head: true });
  console.log('\nTotal phases:', count);
}

checkPhases().catch(console.error);
