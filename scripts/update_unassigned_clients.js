const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateUnassignedClients() {
  // Client info extracted from PDF invoices
  const projectClientMap = {
    '23-15': {
      name: 'MK Management',
      address_line_1: '1011 Collier Road',
      address_line_2: 'Atlanta, GA 30318'
    },
    '23-32': {
      name: 'Kennedy Civil Services, Inc.',
      address_line_1: '3731 Eagle Ridge Drive',
      address_line_2: 'Jacksonville, FL 32224'
    },
    '24-02': {
      name: 'Starlight Homes Florida, LLC',
      address_line_1: '1064 Greenwood Blvd Suite 124',
      address_line_2: 'Lake Mary, FL 32746'
    },
    '24-03': {
      name: 'Pulte Home Company',
      address_line_1: '12724 Gran Bay Parkway West, Suite 200',
      address_line_2: 'Jacksonville, FL 32258'
    },
    '24-13': {
      name: 'Pulte Home Company, LLC',
      address_line_1: '12724 Gran Bay Parkway West, Suite 200',
      address_line_2: 'Jacksonville, FL 32258'
    },
    '25-01': {
      name: 'Starlight Homes Florida, LLC',
      address_line_1: '1064 Greenwood Blvd Suite 124',
      address_line_2: 'Lake Mary, FL 32746'
    },
    '25-05': {
      name: 'Pulte Home Company, LLC',
      address_line_1: '12724 Gran Bay Parkway West, Suite 200',
      address_line_2: 'Jacksonville, FL 32258'
    }
  };

  console.log('=== Updating Unassigned Projects with Correct Clients ===\n');

  // Get existing clients
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name');

  const clientMap = {};
  existingClients?.forEach(c => {
    clientMap[c.name.toLowerCase()] = c.id;
  });

  // Process each project
  for (const [projectNumber, clientInfo] of Object.entries(projectClientMap)) {
    console.log(`Processing ${projectNumber}: ${clientInfo.name}`);

    // Find or create client
    let clientId = clientMap[clientInfo.name.toLowerCase()];

    if (!clientId) {
      // Check for similar names (Pulte variations)
      if (clientInfo.name.includes('Pulte')) {
        const pulteKey = Object.keys(clientMap).find(k => k.includes('pulte'));
        if (pulteKey) {
          clientId = clientMap[pulteKey];
          console.log(`  Using existing Pulte client: ${pulteKey}`);
        }
      }
    }

    if (!clientId) {
      // Create new client
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: clientInfo.name,
          address_line_1: clientInfo.address_line_1,
          address_line_2: clientInfo.address_line_2
        })
        .select('id')
        .single();

      if (error) {
        console.log(`  Error creating client: ${error.message}`);
        continue;
      }

      clientId = newClient.id;
      clientMap[clientInfo.name.toLowerCase()] = clientId;
      console.log(`  Created new client: "${clientInfo.name}" (ID: ${clientId})`);
    } else {
      console.log(`  Using existing client ID: ${clientId}`);
    }

    // Update project
    const { data: project } = await supabase
      .from('projects')
      .select('id, client_id')
      .eq('project_number', projectNumber)
      .single();

    if (project) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ client_id: clientId })
        .eq('id', project.id);

      if (updateError) {
        console.log(`  Error updating project: ${updateError.message}`);
      } else {
        console.log(`  Updated project ${projectNumber} -> client ${clientId}`);
      }
    } else {
      console.log(`  Project ${projectNumber} not found in database`);
    }
  }

  // Delete "Unassigned" client if no longer used
  console.log('\n=== Cleaning Up ===');
  
  const { data: unassignedClient } = await supabase
    .from('clients')
    .select('id')
    .eq('name', 'Unassigned')
    .single();

  if (unassignedClient) {
    const { data: projectsUsing } = await supabase
      .from('projects')
      .select('project_number')
      .eq('client_id', unassignedClient.id);

    if (!projectsUsing || projectsUsing.length === 0) {
      await supabase.from('clients').delete().eq('id', unassignedClient.id);
      console.log('Deleted "Unassigned" client');
    } else {
      console.log(`"Unassigned" still used by: ${projectsUsing.map(p => p.project_number).join(', ')}`);
    }
  }

  // Final summary
  const { data: updatedProjects } = await supabase
    .from('projects')
    .select('project_number, name, clients(name)')
    .in('project_number', Object.keys(projectClientMap));

  console.log('\n=== Updated Projects ===');
  updatedProjects?.forEach(p => {
    console.log(`${p.project_number}: ${p.name} -> ${p.clients?.name || 'No client'}`);
  });

  const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  console.log('\nTotal clients:', clientCount);
}

updateUnassignedClients().catch(console.error);
