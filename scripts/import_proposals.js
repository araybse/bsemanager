require('dotenv').config({ path: '.env.local' });
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Excel date to JS date
function excelDateToJS(excelDate) {
  if (!excelDate || typeof excelDate !== 'number') return null;
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

async function importProposals() {
  const workbook = XLSX.readFile('Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm');
  const sheet = workbook.Sheets['Proposals'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Skip header row
  const rows = data.slice(1);
  
  // Get existing profiles for PM lookup
  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  const profileMap = {};
  profiles?.forEach(p => {
    profileMap[p.full_name?.toLowerCase()] = p.id;
  });
  
  console.log('Available PMs:', Object.keys(profileMap));
  
  const proposals = [];
  
  for (const row of rows) {
    const proposalNumber = row[0];
    if (!proposalNumber || typeof proposalNumber !== 'string' || !proposalNumber.match(/^\d{2}-\d{2}$/)) {
      continue; // Skip invalid rows
    }
    
    const projectNumber = row[1] || null;
    const pmName = row[2] || null;
    const name = row[3];
    const totalAmount = row[4] || 0;
    const subConsultants = row[5] || 0;
    const bseAmount = row[6] || 0;
    const dateSubmitted = excelDateToJS(row[7]);
    const dateExecuted = excelDateToJS(row[8]);
    
    // Look up PM ID
    let pmId = null;
    if (pmName) {
      pmId = profileMap[pmName.toLowerCase()] || null;
    }
    
    proposals.push({
      proposal_number: proposalNumber,
      project_number: projectNumber,
      pm_name: pmName,
      pm_id: pmId,
      name: name,
      total_amount: totalAmount,
      sub_consultants: subConsultants,
      bse_amount: bseAmount,
      date_submitted: dateSubmitted,
      date_executed: dateExecuted,
    });
  }
  
  console.log(`Found ${proposals.length} proposals to import`);
  console.log('Sample proposals:', proposals.slice(0, 3));
  
  // Clear existing proposals
  console.log('Clearing existing proposals...');
  const { error: deleteError } = await supabase.from('proposals').delete().gte('id', 0);
  if (deleteError) {
    console.error('Error clearing proposals:', deleteError);
    return;
  }
  
  // Insert proposals in batches
  const batchSize = 50;
  for (let i = 0; i < proposals.length; i += batchSize) {
    const batch = proposals.slice(i, i + batchSize);
    const { data: inserted, error } = await supabase.from('proposals').insert(batch).select();
    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
      console.error('Failed batch:', batch[0]);
    } else {
      console.log(`Inserted batch ${i / batchSize + 1}: ${inserted.length} proposals`);
    }
  }
  
  console.log('Done importing proposals!');
  
  // Verify
  const { data: count } = await supabase.from('proposals').select('id', { count: 'exact' });
  console.log(`Total proposals in database: ${count?.length}`);
}

importProposals().catch(console.error);
