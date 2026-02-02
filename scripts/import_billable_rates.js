const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importBillableRates() {
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  const workbook = XLSX.readFile(filePath);
  
  // Read Billable Rates Matrix
  const ratesSheet = workbook.Sheets['Billable Rates Matrix'];
  const ratesData = XLSX.utils.sheet_to_json(ratesSheet, { header: 1 });
  
  console.log('=== Billable Rates Matrix Structure ===');
  console.log('Headers:', ratesData[0]);
  console.log('Sample rows:');
  for (let i = 1; i < Math.min(5, ratesData.length); i++) {
    console.log(`Row ${i}:`, ratesData[i]);
  }
  console.log('Total rows:', ratesData.length);
  
  // Get employee names from header row (columns 1-5)
  const headerRow = ratesData[0];
  const employees = [];
  for (let col = 1; col <= 5; col++) {
    if (headerRow[col]) {
      employees.push({ col, name: headerRow[col] });
    }
  }
  console.log('\nEmployees found:', employees.map(e => e.name));
  
  // Get all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number');
  
  const projectMap = {};
  projects?.forEach(p => {
    projectMap[p.project_number] = p.id;
  });
  console.log('Projects in database:', Object.keys(projectMap).length);
  
  // Get employee profiles to get employee IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name');
  
  const profileMap = {};
  profiles?.forEach(p => {
    profileMap[p.full_name] = p.id;
  });
  console.log('Profiles in database:', profileMap);
  
  // Build billable rates entries
  const billableRates = [];
  const missingProjects = new Set();
  
  for (let i = 1; i < ratesData.length; i++) {
    const row = ratesData[i];
    const projectNumber = row[0];
    
    if (!projectNumber) continue;
    
    const projectId = projectMap[projectNumber];
    if (!projectId) {
      missingProjects.add(projectNumber);
      continue;
    }
    
    // For each employee, create a rate entry
    for (const emp of employees) {
      const rate = row[emp.col];
      if (!rate || rate === 0) continue;
      
      // Try to find employee ID, or use null
      const employeeId = profileMap[emp.name] || null;
      
      billableRates.push({
        project_id: projectId,
        employee_id: employeeId || '00000000-0000-0000-0000-000000000000', // placeholder UUID
        employee_name: emp.name,
        hourly_rate: Number(rate),
        effective_from: '2023-01-01' // Default effective date
      });
    }
  }
  
  console.log('\nBillable rates to import:', billableRates.length);
  if (missingProjects.size > 0) {
    console.log('Missing projects:', Array.from(missingProjects));
  }
  
  // Clear existing billable rates first
  console.log('\nClearing existing billable rates...');
  const { error: deleteError } = await supabase
    .from('billable_rates')
    .delete()
    .neq('id', 0); // Delete all
  
  if (deleteError) {
    console.error('Delete error:', deleteError.message);
  }
  
  // Insert new rates in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  
  for (let i = 0; i < billableRates.length; i += BATCH_SIZE) {
    const batch = billableRates.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('billable_rates')
      .insert(batch)
      .select('id');
    
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      console.error('Sample failed record:', batch[0]);
    } else {
      inserted += data.length;
    }
  }
  
  console.log('Inserted', inserted, 'billable rate entries');
  
  // Final count
  const { count } = await supabase.from('billable_rates').select('*', { count: 'exact', head: true });
  console.log('\nTotal billable rates in database:', count);
}

importBillableRates().catch(console.error);
