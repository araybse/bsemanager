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

async function importRemainingLineItems() {
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  const workbook = XLSX.readFile(filePath);
  
  // Get all invoices
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number');
  
  const invoiceMap = {};
  allInvoices?.forEach(inv => {
    invoiceMap[inv.invoice_number] = inv.id;
  });
  
  // Get existing line items to avoid duplicates
  const { data: existingItems } = await supabase
    .from('invoice_line_items')
    .select('invoice_id, phase_name, amount');
  
  const existingSet = new Set();
  existingItems?.forEach(item => {
    existingSet.add(`${item.invoice_id}-${item.phase_name}-${item.amount}`);
  });
  
  // Read invoice detail
  const detailSheet = workbook.Sheets['Invoice Detail'];
  const detailData = XLSX.utils.sheet_to_json(detailSheet, { header: 1 });
  
  const newLineItems = [];
  
  for (let i = 1; i < detailData.length; i++) {
    const row = detailData[i];
    if (!row[0]) continue;
    
    const projectNumber = row[0];
    const invoiceNumber = String(row[1]);
    const invoiceDate = formatDate(row[2]);
    const phaseName = row[3];
    const fee = row[4];
    
    if (!invoiceNumber || !phaseName || !fee) continue;
    
    const invoiceId = invoiceMap[invoiceNumber];
    if (!invoiceId) continue;
    
    const key = `${invoiceId}-${phaseName}-${fee}`;
    if (existingSet.has(key)) continue; // Skip if already exists
    
    newLineItems.push({
      invoice_id: invoiceId,
      project_number: String(projectNumber),
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      phase_name: phaseName,
      amount: Number(fee)
    });
    
    existingSet.add(key); // Mark as added
  }
  
  console.log('New line items to create:', newLineItems.length);
  
  if (newLineItems.length > 0) {
    const BATCH_SIZE = 50;
    let inserted = 0;
    
    for (let i = 0; i < newLineItems.length; i += BATCH_SIZE) {
      const batch = newLineItems.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('invoice_line_items')
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error(`Batch error:`, error.message);
      } else {
        inserted += data.length;
      }
    }
    
    console.log('Inserted', inserted, 'new line items');
  }
  
  // Final counts
  const { count: lineCount } = await supabase.from('invoice_line_items').select('*', { count: 'exact', head: true });
  console.log('\nTotal invoice line items:', lineCount);
}

importRemainingLineItems().catch(console.error);
