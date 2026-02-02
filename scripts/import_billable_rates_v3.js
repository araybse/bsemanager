const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
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
  const employeeNames = [];
  for (let col = 1; col <= 5; col++) {
    if (headerRow[col]) {
      employeeNames.push({ col, name: headerRow[col] });
    }
  }
  console.log('Employees:', employeeNames.map(e => e.name));
  
  // Get existing profiles
  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('id, full_name');
  
  const profileMap = {};
  existingProfiles?.forEach(p => {
    profileMap[p.full_name] = p.id;
  });
  
  // Generate consistent UUIDs for employees without profiles
  // Use a fixed mapping to ensure consistency
  const employeeUUIDs = {
    'Austin Ray': profileMap['Austin Ray'] || '2a938c8c-69eb-475a-b086-a4e3a28de0a8',
    'Austin Burke': profileMap['Austin Burke'] || '11111111-1111-1111-1111-111111111111',
    'Wesley Koning': profileMap['Wesley Koning'] || '22222222-2222-2222-2222-222222222222',
    'Morgan Wilson': profileMap['Morgan Wilson'] || '33333333-3333-3333-3333-333333333333',
    'Arber Meta': profileMap['Arber Meta'] || '44444444-4444-4444-4444-444444444444',
  };
  
  console.log('Employee UUIDs:', employeeUUIDs);
  
  // Get all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number');
  
  const projectMap = {};
  projects?.forEach(p => {
    projectMap[p.project_number] = p.id;
  });
  console.log('Projects count:', Object.keys(projectMap).length);
  
  // Clear ALL existing billable rates using RPC or raw delete
  console.log('\n=== Clearing existing billable rates ===');
  
  // Get all IDs first
  let allIds = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('billable_rates')
      .select('id')
      .range(offset, offset + pageSize - 1);
    
    if (!batch || batch.length === 0) break;
    allIds = allIds.concat(batch.map(r => r.id));
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  
  console.log('Found', allIds.length, 'existing rates to delete');
  
  if (allIds.length > 0) {
    // Delete in batches
    for (let i = 0; i < allIds.length; i += 100) {
      const batch = allIds.slice(i, i + 100);
      await supabase.from('billable_rates').delete().in('id', batch);
    }
    console.log('Deleted existing rates');
  }
  
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
    for (const emp of employeeNames) {
      const rate = row[emp.col];
      if (!rate || rate === 0) continue;
      
      const employeeId = employeeUUIDs[emp.name];
      if (!employeeId) continue;
      
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
  
  // Final count
  const { count } = await supabase.from('billable_rates').select('*', { count: 'exact', head: true });
  console.log('Total billable rates in database:', count);
  
  // Show sample grouped by project
  const { data: sample } = await supabase
    .from('billable_rates')
    .select('project_id, employee_name, hourly_rate')
    .order('project_id')
    .limit(15);
  console.log('\nSample rates:');
  sample?.forEach(r => console.log(`  Project ${r.project_id}: ${r.employee_name} = $${r.hourly_rate}/hr`));
}

importBillableRates().catch(console.error);
