const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pdfParse = require('pdf-parse');

// Simple PDF text extractor (reads raw text from PDF)
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error reading PDF ${filePath}:`, error.message);
    return null;
  }
}

// Parse client info from invoice text
function parseClientInfo(text, projectNumber) {
  if (!text) return null;
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Find the client name - it's typically after "Invoice No:" line
  // Format is usually:
  // Date: ...
  // Project No: ...
  // Invoice No: ...
  // [Client Name]
  // [Address Line 1]
  // [Address Line 2]
  // [Attn: ...] (optional)
  // Project [Project Name]
  
  let clientName = null;
  let addressLine1 = null;
  let addressLine2 = null;
  let attn = null;
  
  let foundInvoiceNo = false;
  let lineIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('Invoice No:') || line.startsWith('Invoice No')) {
      foundInvoiceNo = true;
      lineIndex = i + 1;
      continue;
    }
    
    if (foundInvoiceNo && lineIndex === i) {
      // This should be the client name
      if (!line.startsWith('Project') && !line.startsWith('Date')) {
        clientName = line;
      }
    }
    
    if (foundInvoiceNo && lineIndex + 1 === i && clientName) {
      // Address line 1
      if (!line.startsWith('Project') && !line.startsWith('Attn')) {
        addressLine1 = line;
      }
    }
    
    if (foundInvoiceNo && lineIndex + 2 === i && clientName) {
      // Address line 2 or Attn
      if (line.startsWith('Attn')) {
        attn = line;
      } else if (!line.startsWith('Project')) {
        addressLine2 = line;
      }
    }
    
    if (foundInvoiceNo && lineIndex + 3 === i && clientName && !attn) {
      if (line.startsWith('Attn')) {
        attn = line;
      }
    }
  }
  
  if (clientName) {
    return {
      name: clientName,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      attn: attn
    };
  }
  
  return null;
}

async function main() {
  const baseDir = 'Z:\\Private\\aray\\Admin\\Invoices';
  const years = ['23', '24', '25', '26'];
  
  console.log('=== Extracting Client Info from PDF Invoices ===\n');
  
  const extractedClients = {};
  
  for (const year of years) {
    const yearDir = path.join(baseDir, year);
    
    if (!fs.existsSync(yearDir)) {
      console.log(`Year folder ${year} not found, skipping...`);
      continue;
    }
    
    const projectFolders = fs.readdirSync(yearDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    
    for (const projectFolder of projectFolders) {
      const projectDir = path.join(yearDir, projectFolder);
      const projectNumber = projectFolder; // e.g., "24-01"
      
      // Find the first PDF invoice
      const files = fs.readdirSync(projectDir);
      const pdfFile = files.find(f => f.endsWith('.pdf') && f.startsWith(projectNumber));
      
      if (!pdfFile) {
        console.log(`No PDF found for ${projectNumber}`);
        continue;
      }
      
      const pdfPath = path.join(projectDir, pdfFile);
      const text = await extractTextFromPDF(pdfPath);
      const clientInfo = parseClientInfo(text, projectNumber);
      
      if (clientInfo) {
        extractedClients[projectNumber] = clientInfo;
        console.log(`${projectNumber}: ${clientInfo.name}`);
      } else {
        console.log(`${projectNumber}: Could not extract client info`);
      }
    }
  }
  
  console.log(`\nExtracted client info for ${Object.keys(extractedClients).length} projects`);
  
  // Now compare with Supabase
  console.log('\n=== Comparing with Supabase ===\n');
  
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number, name, client_id, clients(id, name, address_line_1, address_line_2)');
  
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name, address_line_1, address_line_2');
  
  const clientsByName = {};
  allClients?.forEach(c => {
    clientsByName[c.name.toLowerCase()] = c;
  });
  
  const updates = [];
  const newClients = [];
  const mismatches = [];
  
  for (const proj of projects || []) {
    const extracted = extractedClients[proj.project_number];
    if (!extracted) continue;
    
    const currentClientName = proj.clients?.name || 'None';
    const extractedClientName = extracted.name;
    
    // Check if there's a mismatch
    if (currentClientName.toLowerCase() !== extractedClientName.toLowerCase() &&
        currentClientName !== 'Unassigned') {
      mismatches.push({
        project_number: proj.project_number,
        current: currentClientName,
        extracted: extractedClientName
      });
    }
    
    // If current client is "Unassigned", we need to update
    if (currentClientName === 'Unassigned' || currentClientName === 'None') {
      // Find or create the client
      let existingClient = clientsByName[extractedClientName.toLowerCase()];
      
      if (!existingClient) {
        newClients.push({
          project_number: proj.project_number,
          client: extracted
        });
      }
      
      updates.push({
        project_id: proj.id,
        project_number: proj.project_number,
        client_name: extractedClientName,
        client_info: extracted
      });
    }
  }
  
  console.log('Projects needing client update:', updates.length);
  console.log('New clients to create:', newClients.length);
  console.log('Mismatches found:', mismatches.length);
  
  if (mismatches.length > 0) {
    console.log('\n=== Mismatches (for review) ===');
    mismatches.forEach(m => {
      console.log(`${m.project_number}:`);
      console.log(`  Current:   "${m.current}"`);
      console.log(`  From PDF:  "${m.extracted}"`);
    });
  }
  
  // Create new clients and update projects
  if (updates.length > 0) {
    console.log('\n=== Updating Supabase ===');
    
    for (const update of updates) {
      // Find or create client
      let clientId = clientsByName[update.client_name.toLowerCase()]?.id;
      
      if (!clientId) {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: update.client_info.name,
            address_line_1: update.client_info.address_line_1,
            address_line_2: update.client_info.address_line_2
          })
          .select('id')
          .single();
        
        if (clientError) {
          console.log(`Error creating client "${update.client_name}": ${clientError.message}`);
          continue;
        }
        
        clientId = newClient.id;
        clientsByName[update.client_name.toLowerCase()] = { id: clientId, name: update.client_name };
        console.log(`Created client: "${update.client_name}" (ID: ${clientId})`);
      }
      
      // Update project
      const { error: updateError } = await supabase
        .from('projects')
        .update({ client_id: clientId })
        .eq('id', update.project_id);
      
      if (updateError) {
        console.log(`Error updating project ${update.project_number}: ${updateError.message}`);
      } else {
        console.log(`Updated ${update.project_number} -> "${update.client_name}"`);
      }
    }
  }
  
  // Delete "Unassigned" client if no longer used
  const { data: unassignedClient } = await supabase
    .from('clients')
    .select('id')
    .eq('name', 'Unassigned')
    .single();
  
  if (unassignedClient) {
    const { data: projectsUsingUnassigned } = await supabase
      .from('projects')
      .select('id')
      .eq('client_id', unassignedClient.id);
    
    if (!projectsUsingUnassigned || projectsUsingUnassigned.length === 0) {
      await supabase.from('clients').delete().eq('id', unassignedClient.id);
      console.log('\nDeleted "Unassigned" client (no longer needed)');
    } else {
      console.log(`\n"Unassigned" client still has ${projectsUsingUnassigned.length} projects`);
    }
  }
  
  // Final summary
  const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  
  console.log('\n=== Final Counts ===');
  console.log('Projects:', projCount);
  console.log('Clients:', clientCount);
}

main().catch(console.error);
