const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importContractPhases() {
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  const workbook = XLSX.readFile(filePath);
  
  const sheet = workbook.Sheets['Active Contracts'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log('=== Importing Contract Phases from Active Contracts ===\n');
  
  // Get all projects to map project_number -> project_id
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number');
  
  const projectMap = {};
  projects?.forEach(p => {
    projectMap[p.project_number] = p.id;
  });
  console.log(`Found ${Object.keys(projectMap).length} projects in database`);
  
  // Clear existing phases
  console.log('\nClearing existing contract phases...');
  const { data: existingPhases } = await supabase
    .from('contract_phases')
    .select('id');
  
  if (existingPhases && existingPhases.length > 0) {
    for (let i = 0; i < existingPhases.length; i += 100) {
      const batch = existingPhases.slice(i, i + 100).map(p => p.id);
      await supabase.from('contract_phases').delete().in('id', batch);
    }
    console.log(`Deleted ${existingPhases.length} existing phases`);
  }
  
  // Parse phases from Active Contracts
  // Columns: Project #, Project Name, Phase #, Phase Name, H/L, Total Fee, %, Previous, Remaining, Unbilled, This Month
  const phases = [];
  const missingProjects = new Set();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const projectNumber = row[0];
    const phaseCode = row[2];
    const phaseName = row[3];
    const billingType = row[4]; // H or L
    const totalFee = row[5];
    const pctComplete = row[6]; // percentage as decimal
    const billedToDate = row[7]; // "Previous" column
    
    if (!projectNumber || !phaseCode || !phaseName) continue;
    
    // Skip reimbursables row (ZREIM)
    if (phaseCode === 'ZREIM') continue;
    
    const projectId = projectMap[projectNumber];
    if (!projectId) {
      missingProjects.add(projectNumber);
      continue;
    }
    
    // Convert billing type
    let type = 'L';
    if (billingType === 'H') type = 'H';
    
    phases.push({
      project_id: projectId,
      phase_code: phaseCode,
      phase_name: phaseName,
      billing_type: type,
      total_fee: totalFee || 0,
      billed_to_date: billedToDate || 0,
      bill_this_month: 0,
      unbilled_amount: 0
    });
  }
  
  console.log(`\nParsed ${phases.length} phases from Active Contracts`);
  if (missingProjects.size > 0) {
    console.log('Missing projects:', Array.from(missingProjects));
  }
  
  // Insert phases in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  
  for (let i = 0; i < phases.length; i += BATCH_SIZE) {
    const batch = phases.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('contract_phases')
      .insert(batch)
      .select('id');
    
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
    } else {
      inserted += data.length;
    }
  }
  
  console.log(`\nInserted ${inserted} contract phases`);
  
  // Show sample of imported phases
  const { data: sample } = await supabase
    .from('contract_phases')
    .select('project_id, phase_code, phase_name, billing_type, total_fee, projects(project_number)')
    .order('project_id')
    .limit(20);
  
  console.log('\n=== Sample Imported Phases ===');
  sample?.forEach(p => {
    console.log(`${p.projects?.project_number} | ${p.phase_code} | ${p.phase_name} | ${p.billing_type} | $${p.total_fee}`);
  });
  
  // Show unique phase codes
  const { data: allPhases } = await supabase
    .from('contract_phases')
    .select('phase_code');
  
  const codes = new Set(allPhases?.map(p => p.phase_code));
  console.log('\n=== Unique Phase Codes ===');
  console.log(Array.from(codes).sort().join(', '));
  
  const { count } = await supabase.from('contract_phases').select('*', { count: 'exact', head: true });
  console.log('\nTotal phases in database:', count);
}

importContractPhases().catch(console.error);
