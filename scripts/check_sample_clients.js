const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSampleClients() {
  // These look like sample clients from initial setup
  const sampleClientNames = [
    'City of Springfield',
    'ACME Development Corp',
    'Metro Transit Authority'
  ];
  
  console.log('=== Checking Sample Clients ===\n');
  
  for (const name of sampleClientNames) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .eq('name', name)
      .single();
    
    if (!client) {
      console.log(`"${name}" - Not found`);
      continue;
    }
    
    // Check projects using this client
    const { data: projects } = await supabase
      .from('projects')
      .select('project_number, name')
      .eq('client_id', client.id);
    
    console.log(`"${name}" (ID: ${client.id})`);
    if (projects && projects.length > 0) {
      console.log(`  Used by ${projects.length} projects:`);
      projects.forEach(p => console.log(`    - ${p.project_number}: ${p.name}`));
    } else {
      console.log(`  Not used by any projects - CAN DELETE`);
    }
    console.log();
  }
}

checkSampleClients().catch(console.error);
