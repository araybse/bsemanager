const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDuplicates() {
  // Check reimbursables
  const { data: reimbursables, error: reimbError } = await supabase
    .from('reimbursables')
    .select('id, project_number, date_charged, fee_description');
  
  if (reimbError) {
    console.error('Error:', reimbError);
    return;
  }
  
  console.log('Total reimbursables:', reimbursables.length);
  
  // Check for duplicates
  const seen = new Set();
  const duplicates = [];
  reimbursables.forEach(r => {
    const key = `${r.project_number}-${r.date_charged}-${r.fee_description}`;
    if (seen.has(key)) {
      duplicates.push(r.id);
    } else {
      seen.add(key);
    }
  });
  
  console.log('Duplicate reimbursables to delete:', duplicates.length);
  
  if (duplicates.length > 0) {
    const { error } = await supabase
      .from('reimbursables')
      .delete()
      .in('id', duplicates);
    
    if (error) {
      console.error('Delete error:', error);
    } else {
      console.log('Deleted', duplicates.length, 'duplicate reimbursables');
    }
  }
  
  // Check invoice line items
  const { data: lineItems, error: lineError } = await supabase
    .from('invoice_line_items')
    .select('id, invoice_id, phase_name, amount');
  
  console.log('\nTotal line items:', lineItems?.length);
  
  const seenLines = new Set();
  const dupLines = [];
  lineItems?.forEach(l => {
    const key = `${l.invoice_id}-${l.phase_name}-${l.amount}`;
    if (seenLines.has(key)) {
      dupLines.push(l.id);
    } else {
      seenLines.add(key);
    }
  });
  
  console.log('Duplicate line items to delete:', dupLines.length);
  
  if (dupLines.length > 0) {
    const { error } = await supabase
      .from('invoice_line_items')
      .delete()
      .in('id', dupLines);
    
    if (error) {
      console.error('Delete error:', error);
    } else {
      console.log('Deleted', dupLines.length, 'duplicate line items');
    }
  }
  
  // Final counts
  const { count: reimbCount } = await supabase.from('reimbursables').select('*', { count: 'exact', head: true });
  const { count: lineCount } = await supabase.from('invoice_line_items').select('*', { count: 'exact', head: true });
  const { count: invCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
  
  console.log('\n=== Final Counts ===');
  console.log('Invoices:', invCount);
  console.log('Invoice Line Items:', lineCount);
  console.log('Reimbursables:', reimbCount);
}

checkDuplicates().catch(console.error);
