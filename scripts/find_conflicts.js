const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findConflicts() {
  // Read the real project names from the billing console
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  const workbook = XLSX.readFile(filePath);
  
  const invoiceSheet = workbook.Sheets['Invoice Tracker'];
  const invoiceData = XLSX.utils.sheet_to_json(invoiceSheet, { header: 1 });
  
  // Build map of real project numbers to names from invoices
  const realProjectNames = {};
  for (let i = 1; i < invoiceData.length; i++) {
    const row = invoiceData[i];
    if (row[1] && row[2]) {
      realProjectNames[row[1]] = row[2];
    }
  }
  
  console.log('=== Real Project Names from Billing Console ===');
  
  // Get current projects in database
  const { data: dbProjects } = await supabase
    .from('projects')
    .select('id, project_number, name')
    .order('project_number');
  
  // Compare and find conflicts
  const conflicts = [];
  const sampleProjects = [];
  
  dbProjects?.forEach(dbProj => {
    const realName = realProjectNames[dbProj.project_number];
    
    if (realName && realName !== dbProj.name) {
      conflicts.push({
        project_number: dbProj.project_number,
        db_name: dbProj.name,
        real_name: realName,
        id: dbProj.id
      });
    }
    
    // Check if it's a sample project (created early on with sample names)
    if (dbProj.name.includes('Springfield') || 
        dbProj.name.includes('ACME') || 
        dbProj.name.includes('Metro Bus') ||
        dbProj.name.includes('Metro Transit')) {
      sampleProjects.push(dbProj);
    }
  });
  
  console.log('\n=== Conflicts Found ===');
  conflicts.forEach(c => {
    console.log(`${c.project_number}:`);
    console.log(`  Current DB name: "${c.db_name}"`);
    console.log(`  Real name:       "${c.real_name}"`);
  });
  
  console.log('\n=== Projects with Sample Names ===');
  sampleProjects.forEach(p => {
    console.log(`${p.project_number}: ${p.name}`);
  });
  
  // Fix conflicts by updating to real names
  if (conflicts.length > 0) {
    console.log('\n=== Fixing Conflicts ===');
    for (const c of conflicts) {
      const { error } = await supabase
        .from('projects')
        .update({ name: c.real_name })
        .eq('id', c.id);
      
      if (error) {
        console.log(`Error updating ${c.project_number}: ${error.message}`);
      } else {
        console.log(`Updated ${c.project_number}: "${c.db_name}" -> "${c.real_name}"`);
      }
    }
  }
  
  // Show final state
  console.log('\n=== Updated Projects ===');
  const { data: updated } = await supabase
    .from('projects')
    .select('project_number, name')
    .in('project_number', conflicts.map(c => c.project_number));
  
  updated?.forEach(p => console.log(`${p.project_number}: ${p.name}`));
}

findConflicts().catch(console.error);
