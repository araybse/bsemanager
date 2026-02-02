const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSampleProjects() {
  // Sample project numbers that might have been created during setup
  const sampleProjectNumbers = [
    '24-01', '24-02', '24-03', '23-15'
  ];
  
  console.log('=== Checking Sample Projects ===\n');
  
  for (const pn of sampleProjectNumbers) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, project_number, name')
      .eq('project_number', pn)
      .single();
    
    if (!project) {
      console.log(`${pn} - Not found`);
      continue;
    }
    
    // Check invoices
    const { data: invoices, count: invCount } = await supabase
      .from('invoices')
      .select('invoice_number, amount', { count: 'exact' })
      .eq('project_number', pn);
    
    // Check time entries
    const { count: timeCount } = await supabase
      .from('time_entries')
      .select('*', { count: 'exact', head: true })
      .eq('project_number', pn);
    
    // Check billable rates
    const { count: ratesCount } = await supabase
      .from('billable_rates')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id);
    
    console.log(`${pn}: ${project.name}`);
    console.log(`  Invoices: ${invCount || 0}`);
    console.log(`  Time Entries: ${timeCount || 0}`);
    console.log(`  Billable Rates: ${ratesCount || 0}`);
    
    if (invCount > 0) {
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      console.log(`  Total Invoiced: $${totalAmount.toLocaleString()}`);
    }
    console.log();
  }
  
  // Also show the actual project numbers from the billing console
  console.log('=== Real Projects from Billing Console (sample) ===');
  const { data: realProjects } = await supabase
    .from('invoices')
    .select('project_number, project_name')
    .limit(20);
  
  const unique = new Map();
  realProjects?.forEach(p => unique.set(p.project_number, p.project_name));
  
  console.log('First 20 projects with invoices:');
  Array.from(unique.entries()).slice(0, 20).forEach(([num, name]) => {
    console.log(`  ${num}: ${name}`);
  });
}

checkSampleProjects().catch(console.error);
