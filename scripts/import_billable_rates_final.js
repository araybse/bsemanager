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
  
  const headerRow = ratesData[0];
  const employeeColumns = [];
  for (let col = 1; col <= 5; col++) {
    if (headerRow[col]) {
      employeeColumns.push({ col, name: headerRow[col] });
    }
  }
  console.log('Employees in matrix:', employeeColumns.map(e => e.name));
  
  // Get profiles to map employee names to IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name');
  
  const profileMap = {};
  profiles?.forEach(p => {
    profileMap[p.full_name] = p.id;
  });
  console.log('Profile mapping:', profileMap);
  
  // Get all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number');
  
  const projectMap = {};
  projects?.forEach(p => {
    projectMap[p.project_number] = p.id;
  });
  console.log('Projects count:', Object.keys(projectMap).length);
  
  // Clear existing billable rates
  console.log('\n=== Clearing existing billable rates ===');
  const { data: existingRates } = await supabase
    .from('billable_rates')
    .select('id');
  
  if (existingRates && existingRates.length > 0) {
    for (let i = 0; i < existingRates.length; i += 100) {
      const batch = existingRates.slice(i, i + 100).map(r => r.id);
      await supabase.from('billable_rates').delete().in('id', batch);
    }
    console.log('Deleted', existingRates.length, 'existing rates');
  }
  
  // Build billable rates entries
  const billableRates = [];
  const missingProjects = new Set();
  const missingEmployees = new Set();
  
  for (let i = 1; i < ratesData.length; i++) {
    const row = ratesData[i];
    const projectNumber = row[0];
    
    if (!projectNumber) continue;
    
    const projectId = projectMap[projectNumber];
    if (!projectId) {
      missingProjects.add(projectNumber);
      continue;
    }
    
    for (const emp of employeeColumns) {
      const rate = row[emp.col];
      if (!rate || rate === 0) continue;
      
      const employeeId = profileMap[emp.name];
      if (!employeeId) {
        missingEmployees.add(emp.name);
        continue;
      }
      
      billableRates.push({
        project_id: projectId,
        employee_id: employeeId,
        employee_name: emp.name,
        hourly_rate: Number(rate),
        effective_from: '2023-01-01'
      });
    }
  }
  
  console.log('\nBillable rates to import:', billableRates.length);
  if (missingProjects.size > 0) {
    console.log('Missing projects:', Array.from(missingProjects));
  }
  if (missingEmployees.size > 0) {
    console.log('Missing employees:', Array.from(missingEmployees));
  }
  
  // Insert in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  
  for (let i = 0; i < billableRates.length; i += BATCH_SIZE) {
    const batch = billableRates.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('billable_rates')
      .insert(batch)
      .select('id');
    
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
    } else {
      inserted += data.length;
    }
  }
  
  console.log('\nInserted', inserted, 'billable rate entries');
  
  // Final count and sample
  const { count } = await supabase.from('billable_rates').select('*', { count: 'exact', head: true });
  console.log('Total billable rates in database:', count);
  
  // Show sample by project
  const { data: sample } = await supabase
    .from('billable_rates')
    .select(`
      project_id,
      employee_name,
      hourly_rate,
      projects!inner(project_number)
    `)
    .order('project_id')
    .limit(20);
  
  console.log('\nSample rates:');
  sample?.forEach(r => {
    console.log(`  ${r.projects.project_number}: ${r.employee_name} = $${r.hourly_rate}/hr`);
  });
}

importBillableRates().catch(console.error);
