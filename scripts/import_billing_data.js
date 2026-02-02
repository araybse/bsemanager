const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Convert Excel serial date to JavaScript Date
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null;
  // Excel dates start from Jan 1, 1900 (serial 1)
  // But there's a bug in Excel where 1900 is treated as a leap year
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date = new Date(utc_value * 1000);
  return date.toISOString().split('T')[0];
}

// Format date for SQL
function formatDate(date) {
  if (!date) return null;
  if (typeof date === 'number') return excelDateToJS(date);
  return date;
}

async function importData() {
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  console.log('Reading file:', filePath);
  
  const workbook = XLSX.readFile(filePath);
  
  // First, get all existing projects to map project_number -> project_id
  console.log('\n=== Fetching existing projects ===');
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id, project_number, name');
  
  if (projectError) {
    console.error('Error fetching projects:', projectError);
    return;
  }
  
  const projectMap = {};
  projects.forEach(p => {
    projectMap[p.project_number] = { id: p.id, name: p.name };
  });
  console.log(`Found ${projects.length} existing projects`);
  
  // === IMPORT INVOICES ===
  console.log('\n=== Importing Invoices ===');
  const invoiceSheet = workbook.Sheets['Invoice Tracker'];
  const invoiceData = XLSX.utils.sheet_to_json(invoiceSheet, { header: 1 });
  
  // Skip header row
  const invoices = [];
  const missingProjects = new Set();
  
  for (let i = 1; i < invoiceData.length; i++) {
    const row = invoiceData[i];
    if (!row[0]) continue; // Skip empty rows
    
    const invoiceNumber = row[0];
    const projectNumber = row[1];
    const projectName = row[2];
    const dateIssued = formatDate(row[3]);
    const amount = row[4];
    const budgetDate = formatDate(row[5]);
    const datePaid = formatDate(row[6]);
    
    // Skip if no valid data
    if (!invoiceNumber || !projectNumber || !dateIssued || !amount) continue;
    
    const project = projectMap[projectNumber];
    if (!project) {
      missingProjects.add(projectNumber);
      continue;
    }
    
    invoices.push({
      invoice_number: String(invoiceNumber),
      project_id: project.id,
      project_number: String(projectNumber),
      project_name: projectName || project.name,
      date_issued: dateIssued,
      amount: Number(amount),
      budget_date: budgetDate,
      date_paid: datePaid
    });
  }
  
  console.log(`Found ${invoices.length} invoices to import`);
  if (missingProjects.size > 0) {
    console.log('Missing projects (need to create):', Array.from(missingProjects));
  }
  
  // Insert invoices in batches
  const BATCH_SIZE = 50;
  let insertedInvoices = 0;
  const invoiceMap = {}; // Map invoice_number -> invoice_id
  
  for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
    const batch = invoices.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('invoices')
      .upsert(batch, { onConflict: 'invoice_number', ignoreDuplicates: false })
      .select('id, invoice_number');
    
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
    } else {
      insertedInvoices += data.length;
      data.forEach(inv => {
        invoiceMap[inv.invoice_number] = inv.id;
      });
    }
  }
  console.log(`Inserted/updated ${insertedInvoices} invoices`);
  
  // Fetch all invoice IDs for line items
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number');
  
  allInvoices?.forEach(inv => {
    invoiceMap[inv.invoice_number] = inv.id;
  });
  
  // === IMPORT INVOICE LINE ITEMS (Invoice Detail) ===
  console.log('\n=== Importing Invoice Line Items ===');
  const detailSheet = workbook.Sheets['Invoice Detail'];
  const detailData = XLSX.utils.sheet_to_json(detailSheet, { header: 1 });
  
  const lineItems = [];
  
  for (let i = 1; i < detailData.length; i++) {
    const row = detailData[i];
    if (!row[0]) continue;
    
    const projectNumber = row[0];
    const invoiceNumber = row[1];
    const invoiceDate = formatDate(row[2]);
    const phaseName = row[3];
    const fee = row[4];
    
    if (!invoiceNumber || !phaseName || !fee) continue;
    
    const invoiceId = invoiceMap[String(invoiceNumber)];
    if (!invoiceId) {
      // Try to find with different formatting
      continue;
    }
    
    // Don't specify line_type - let it use database default
    lineItems.push({
      invoice_id: invoiceId,
      project_number: String(projectNumber),
      invoice_number: String(invoiceNumber),
      invoice_date: invoiceDate,
      phase_name: phaseName,
      amount: Number(fee)
    });
  }
  
  console.log(`Found ${lineItems.length} line items to import`);
  
  // Insert line items in batches
  let insertedLineItems = 0;
  for (let i = 0; i < lineItems.length; i += BATCH_SIZE) {
    const batch = lineItems.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('invoice_line_items')
      .insert(batch)
      .select('id');
    
    if (error) {
      console.error(`Line items batch ${i / BATCH_SIZE + 1} error:`, error.message);
    } else {
      insertedLineItems += data.length;
    }
  }
  console.log(`Inserted ${insertedLineItems} line items`);
  
  // === IMPORT REIMBURSABLES ===
  console.log('\n=== Importing Reimbursables ===');
  const reimbSheet = workbook.Sheets['Reimbursables'];
  const reimbData = XLSX.utils.sheet_to_json(reimbSheet, { header: 1 });
  
  const reimbursables = [];
  
  for (let i = 1; i < reimbData.length; i++) {
    const row = reimbData[i];
    if (!row[0]) continue;
    
    const projectNumber = row[0];
    const projectName = row[1];
    const dateCharged = formatDate(row[2]);
    const feeDescription = row[3];
    const feeAmount = row[4];
    const amountToCharge = row[5];
    const invoiceNumber = row[6];
    const dateInvoiced = formatDate(row[7]);
    
    if (!projectNumber || !feeDescription || !feeAmount) continue;
    
    const project = projectMap[projectNumber];
    if (!project) {
      missingProjects.add(projectNumber);
      continue;
    }
    
    // Calculate markup percentage
    const markupPct = feeAmount > 0 ? ((amountToCharge - feeAmount) / feeAmount) * 100 : 15;
    
    // Get invoice ID if exists
    const invoiceId = invoiceNumber ? invoiceMap[String(invoiceNumber)] : null;
    
    reimbursables.push({
      project_id: project.id,
      project_number: String(projectNumber),
      project_name: projectName || project.name,
      date_charged: dateCharged,
      fee_description: feeDescription,
      fee_amount: Number(feeAmount),
      markup_pct: Math.round(markupPct * 100) / 100,
      // amount_to_charge is computed from fee_amount * (1 + markup_pct/100)
      invoice_id: invoiceId,
      invoice_number: invoiceNumber ? String(invoiceNumber) : null,
      date_invoiced: dateInvoiced
    });
  }
  
  console.log(`Found ${reimbursables.length} reimbursables to import`);
  
  // Insert reimbursables in batches
  let insertedReimbursables = 0;
  for (let i = 0; i < reimbursables.length; i += BATCH_SIZE) {
    const batch = reimbursables.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('reimbursables')
      .insert(batch)
      .select('id');
    
    if (error) {
      console.error(`Reimbursables batch ${i / BATCH_SIZE + 1} error:`, error.message);
    } else {
      insertedReimbursables += data.length;
    }
  }
  console.log(`Inserted ${insertedReimbursables} reimbursables`);
  
  // Summary
  console.log('\n=== Import Summary ===');
  console.log(`Invoices: ${insertedInvoices}`);
  console.log(`Invoice Line Items: ${insertedLineItems}`);
  console.log(`Reimbursables: ${insertedReimbursables}`);
  
  if (missingProjects.size > 0) {
    console.log('\n=== Missing Projects (not imported) ===');
    console.log(Array.from(missingProjects).join(', '));
  }
}

importData().catch(console.error);
