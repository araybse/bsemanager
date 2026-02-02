const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMissingProjects() {
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  const workbook = XLSX.readFile(filePath);
  
  // Get project info from Client Info sheet
  const clientSheet = workbook.Sheets['Client Info'];
  const clientData = XLSX.utils.sheet_to_json(clientSheet, { header: 1 });
  
  // Get project names from Invoice Tracker
  const invoiceSheet = workbook.Sheets['Invoice Tracker'];
  const invoiceData = XLSX.utils.sheet_to_json(invoiceSheet, { header: 1 });
  
  // Build a map of project_number -> project_name from invoices
  const projectNames = {};
  for (let i = 1; i < invoiceData.length; i++) {
    const row = invoiceData[i];
    if (row[1] && row[2]) {
      projectNames[row[1]] = row[2];
    }
  }
  
  // Get existing projects
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('project_number');
  
  const existingSet = new Set(existingProjects?.map(p => p.project_number) || []);
  
  // Missing projects
  const missingProjectNumbers = ['25-07', '25-09', '25-17', '25-05', '25-01', '24-13', '23-32', 'PARC'];
  
  console.log('Project names from invoices:');
  missingProjectNumbers.forEach(pn => {
    console.log(`  ${pn}: ${projectNames[pn] || 'UNKNOWN'}`);
  });
  
  // Get or create a default client
  let { data: defaultClient } = await supabase
    .from('clients')
    .select('id')
    .limit(1)
    .single();
  
  if (!defaultClient) {
    const { data } = await supabase
      .from('clients')
      .insert({ name: 'Unknown Client' })
      .select('id')
      .single();
    defaultClient = data;
  }
  
  // Create missing projects
  const projectsToCreate = missingProjectNumbers
    .filter(pn => !existingSet.has(pn))
    .map(pn => ({
      project_number: pn,
      name: projectNames[pn] || `Project ${pn}`,
      client_id: defaultClient?.id,
      status: 'active'
    }));
  
  console.log('\nProjects to create:', projectsToCreate.length);
  
  if (projectsToCreate.length > 0) {
    const { data, error } = await supabase
      .from('projects')
      .insert(projectsToCreate)
      .select();
    
    if (error) {
      console.error('Error creating projects:', error.message);
    } else {
      console.log('Created projects:', data.map(p => p.project_number));
    }
  }
  
  // Now re-run the invoice import for missing invoices
  console.log('\n=== Re-importing invoices for newly created projects ===');
  
  // Get all projects
  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, project_number, name');
  
  const projectMap = {};
  allProjects?.forEach(p => {
    projectMap[p.project_number] = { id: p.id, name: p.name };
  });
  
  // Get all existing invoices
  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('invoice_number');
  
  const existingInvoiceSet = new Set(existingInvoices?.map(i => i.invoice_number) || []);
  
  // Convert Excel serial date to JavaScript Date
  function excelDateToJS(serial) {
    if (!serial || typeof serial !== 'number') return null;
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date = new Date(utc_value * 1000);
    return date.toISOString().split('T')[0];
  }
  
  function formatDate(date) {
    if (!date) return null;
    if (typeof date === 'number') return excelDateToJS(date);
    return date;
  }
  
  const newInvoices = [];
  
  for (let i = 1; i < invoiceData.length; i++) {
    const row = invoiceData[i];
    if (!row[0]) continue;
    
    const invoiceNumber = String(row[0]);
    const projectNumber = row[1];
    const projectName = row[2];
    const dateIssued = formatDate(row[3]);
    const amount = row[4];
    const budgetDate = formatDate(row[5]);
    const datePaid = formatDate(row[6]);
    
    if (!invoiceNumber || !projectNumber || !dateIssued || !amount) continue;
    if (existingInvoiceSet.has(invoiceNumber)) continue; // Skip existing
    
    const project = projectMap[projectNumber];
    if (!project) continue; // Still missing
    
    newInvoices.push({
      invoice_number: invoiceNumber,
      project_id: project.id,
      project_number: String(projectNumber),
      project_name: projectName || project.name,
      date_issued: dateIssued,
      amount: Number(amount),
      budget_date: budgetDate,
      date_paid: datePaid
    });
  }
  
  console.log('New invoices to create:', newInvoices.length);
  
  if (newInvoices.length > 0) {
    const { data, error } = await supabase
      .from('invoices')
      .insert(newInvoices)
      .select('invoice_number');
    
    if (error) {
      console.error('Error inserting invoices:', error.message);
    } else {
      console.log('Inserted', data.length, 'new invoices');
    }
  }
  
  // Final counts
  const { count: invCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
  const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  
  console.log('\n=== Final Counts ===');
  console.log('Projects:', projCount);
  console.log('Invoices:', invCount);
}

createMissingProjects().catch(console.error);
