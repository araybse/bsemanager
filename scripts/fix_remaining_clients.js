const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRemainingClients() {
  // Projects still using sample clients
  const projectsToFix = ['25-05', '25-01', '24-13', '23-32', '23-15', '24-02', '24-03'];
  
  console.log('=== Projects Still Using Sample Clients ===');
  
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number, name, client_id, clients(name)')
    .in('project_number', projectsToFix);
  
  projects?.forEach(p => {
    console.log(`${p.project_number}: ${p.name}`);
    console.log(`  Current client: ${p.clients?.name || 'None'}`);
  });
  
  // Get existing real clients that might be correct
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');
  
  console.log('\n=== Available Real Clients ===');
  clients?.forEach(c => {
    if (!['City of Springfield', 'ACME Development Corp', 'Metro Transit Authority'].includes(c.name)) {
      console.log(`  ${c.id}: ${c.name}`);
    }
  });
  
  // For now, let's assign these to a generic "Unknown Client" or create based on project name pattern
  // Or we can just remove the sample clients by reassigning to an existing real client
  
  // Let's find projects that seem related and reassign
  // For example, projects with similar names might belong to the same client
  
  // Actually, let's just create an "Unassigned" client for these orphan projects
  // and delete the sample clients
  
  let { data: unassignedClient } = await supabase
    .from('clients')
    .select('id')
    .eq('name', 'Unassigned')
    .single();
  
  if (!unassignedClient) {
    const { data: newClient } = await supabase
      .from('clients')
      .insert({ name: 'Unassigned', address_line_1: 'To be determined' })
      .select('id')
      .single();
    unassignedClient = newClient;
    console.log('\nCreated "Unassigned" client');
  }
  
  // Update projects to use Unassigned client
  const sampleClientNames = ['City of Springfield', 'ACME Development Corp', 'Metro Transit Authority'];
  
  for (const p of projects || []) {
    if (sampleClientNames.includes(p.clients?.name)) {
      await supabase
        .from('projects')
        .update({ client_id: unassignedClient.id })
        .eq('id', p.id);
      console.log(`Reassigned ${p.project_number} to "Unassigned"`);
    }
  }
  
  // Now delete sample clients
  console.log('\n=== Deleting Sample Clients ===');
  
  for (const name of sampleClientNames) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('name', name)
      .single();
    
    if (client) {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);
      
      if (!error) {
        console.log(`Deleted: "${name}"`);
      } else {
        console.log(`Error deleting "${name}": ${error.message}`);
      }
    }
  }
  
  // Final counts
  const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  console.log('\nTotal clients:', clientCount);
}

fixRemainingClients().catch(console.error);
