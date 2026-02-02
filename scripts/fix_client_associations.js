const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixClientAssociations() {
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  const workbook = XLSX.readFile(filePath);
  
  // Read Client Info sheet
  const clientSheet = workbook.Sheets['Client Info'];
  const clientData = XLSX.utils.sheet_to_json(clientSheet, { header: 1 });
  
  console.log('=== Client Info from Billing Console ===');
  
  // Build map of project_number -> client info
  const projectClients = {};
  for (let i = 1; i < clientData.length; i++) {
    const row = clientData[i];
    if (row[0] && row[1]) {
      projectClients[row[0]] = {
        name: row[1],
        address_line_1: row[2] || null,
        address_line_2: row[3] || null,
        email: row[4] || null
      };
    }
  }
  
  console.log(`Found ${Object.keys(projectClients).length} project-client mappings`);
  
  // Get all existing clients
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name');
  
  const clientMap = {};
  existingClients?.forEach(c => {
    clientMap[c.name] = c.id;
  });
  
  // Sample clients to potentially remove
  const sampleClientNames = ['City of Springfield', 'ACME Development Corp', 'Metro Transit Authority'];
  
  // Get all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number, name, client_id');
  
  console.log('\n=== Updating Client Associations ===');
  
  let updated = 0;
  let clientsCreated = 0;
  
  for (const proj of projects || []) {
    const clientInfo = projectClients[proj.project_number];
    if (!clientInfo) continue;
    
    // Find or create the client
    let clientId = clientMap[clientInfo.name];
    
    if (!clientId) {
      // Create new client
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: clientInfo.name,
          address_line_1: clientInfo.address_line_1,
          address_line_2: clientInfo.address_line_2,
          email: clientInfo.email
        })
        .select('id')
        .single();
      
      if (error) {
        console.log(`Error creating client "${clientInfo.name}": ${error.message}`);
        continue;
      }
      
      clientId = newClient.id;
      clientMap[clientInfo.name] = clientId;
      clientsCreated++;
      console.log(`Created client: "${clientInfo.name}" (ID: ${clientId})`);
    }
    
    // Update project's client_id if different
    if (proj.client_id !== clientId) {
      const { error } = await supabase
        .from('projects')
        .update({ client_id: clientId })
        .eq('id', proj.id);
      
      if (!error) {
        updated++;
      }
    }
  }
  
  console.log(`\nUpdated ${updated} project-client associations`);
  console.log(`Created ${clientsCreated} new clients`);
  
  // Now check if sample clients can be deleted
  console.log('\n=== Checking Sample Clients ===');
  
  for (const name of sampleClientNames) {
    const clientId = clientMap[name];
    if (!clientId) continue;
    
    const { data: projectsUsing } = await supabase
      .from('projects')
      .select('project_number')
      .eq('client_id', clientId);
    
    if (!projectsUsing || projectsUsing.length === 0) {
      // Safe to delete
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (!error) {
        console.log(`Deleted sample client: "${name}"`);
      }
    } else {
      console.log(`Cannot delete "${name}" - still used by: ${projectsUsing.map(p => p.project_number).join(', ')}`);
    }
  }
  
  // Final counts
  const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  
  console.log('\n=== Final Counts ===');
  console.log('Projects:', projCount);
  console.log('Clients:', clientCount);
}

fixClientAssociations().catch(console.error);
