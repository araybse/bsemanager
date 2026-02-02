const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupSampleData() {
  // Find sample/placeholder projects (projects with generic names like "Project XX-XX")
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number, name, client_id');
  
  console.log('=== All Projects ===');
  const sampleProjects = [];
  const realProjects = [];
  
  projects?.forEach(p => {
    // Check if name is generic (starts with "Project " followed by project number)
    const isGeneric = p.name === `Project ${p.project_number}` || 
                      p.name.startsWith('Project ') && p.name.length < 20;
    
    if (isGeneric) {
      sampleProjects.push(p);
      console.log(`  [SAMPLE] ${p.project_number}: "${p.name}"`);
    } else {
      realProjects.push(p);
    }
  });
  
  console.log(`\nReal projects: ${realProjects.length}`);
  console.log(`Sample projects to remove: ${sampleProjects.length}`);
  
  // Find sample/placeholder clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name');
  
  console.log('\n=== All Clients ===');
  const sampleClients = [];
  const realClients = [];
  
  clients?.forEach(c => {
    // Check for generic client names
    const isGeneric = c.name === 'Unknown Client' || 
                      c.name.startsWith('Sample ') ||
                      c.name.startsWith('Test ');
    
    if (isGeneric) {
      sampleClients.push(c);
      console.log(`  [SAMPLE] ${c.id}: "${c.name}"`);
    } else {
      realClients.push(c);
      console.log(`  [REAL] ${c.id}: "${c.name}"`);
    }
  });
  
  console.log(`\nReal clients: ${realClients.length}`);
  console.log(`Sample clients to remove: ${sampleClients.length}`);
  
  // Delete sample projects (this will cascade to related records)
  if (sampleProjects.length > 0) {
    console.log('\n=== Deleting Sample Projects ===');
    
    for (const proj of sampleProjects) {
      // First delete related billable_rates
      await supabase
        .from('billable_rates')
        .delete()
        .eq('project_id', proj.id);
      
      // Delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', proj.id);
      
      if (error) {
        console.log(`  Error deleting ${proj.project_number}: ${error.message}`);
      } else {
        console.log(`  Deleted: ${proj.project_number}`);
      }
    }
  }
  
  // Delete sample clients (only if no projects reference them)
  if (sampleClients.length > 0) {
    console.log('\n=== Deleting Sample Clients ===');
    
    for (const client of sampleClients) {
      // Check if any projects reference this client
      const { data: projectsUsingClient } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', client.id);
      
      if (projectsUsingClient && projectsUsingClient.length > 0) {
        console.log(`  Skipping "${client.name}" - ${projectsUsingClient.length} projects reference it`);
      } else {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', client.id);
        
        if (error) {
          console.log(`  Error deleting "${client.name}": ${error.message}`);
        } else {
          console.log(`  Deleted: "${client.name}"`);
        }
      }
    }
  }
  
  // Final counts
  const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  const { count: ratesCount } = await supabase.from('billable_rates').select('*', { count: 'exact', head: true });
  
  console.log('\n=== Final Counts ===');
  console.log('Projects:', projCount);
  console.log('Clients:', clientCount);
  console.log('Billable Rates:', ratesCount);
}

cleanupSampleData().catch(console.error);
