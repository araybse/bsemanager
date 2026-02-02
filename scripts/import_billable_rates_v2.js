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
  
  // Get employee names and titles from the sheet (columns 7 and 8 have employee info)
  const employeeInfo = {};
  for (let i = 1; i < ratesData.length; i++) {
    const row = ratesData[i];
    if (row[7] && row[8]) {
      employeeInfo[row[7]] = row[8]; // name -> title
    }
  }
  console.log('Employee info from sheet:', employeeInfo);
  
  // Get employee names from header row (columns 1-5)
  const headerRow = ratesData[0];
  const employeeNames = [];
  for (let col = 1; col <= 5; col++) {
    if (headerRow[col]) {
      employeeNames.push(headerRow[col]);
    }
  }
  console.log('Employees in rate matrix:', employeeNames);
  
  // Get existing profiles
  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, email');
  
  const profileMap = {};
  existingProfiles?.forEach(p => {
    profileMap[p.full_name] = p.id;
  });
  console.log('\nExisting profiles:', Object.keys(profileMap));
  
  // Create profiles for missing employees (using placeholder emails/auth)
  // Note: For billable_rates, we'll use employee_name field instead of employee_id
  // since these employees may not have Supabase Auth accounts
  
  // First, let's clear all existing billable rates properly
  console.log('\n=== Clearing existing billable rates ===');
  const { data: existingRates, error: fetchError } = await supabase
    .from('billable_rates')
    .select('id');
  
  if (existingRates && existingRates.length > 0) {
    const ids = existingRates.map(r => r.id);
    const { error: delError } = await supabase
      .from('billable_rates')
      .delete()
      .in('id', ids);
    
    if (delError) {
      console.error('Delete error:', delError.message);
    } else {
      console.log('Deleted', ids.length, 'existing rates');
    }
  }
  
  // Get all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number');
  
  const projectMap = {};
  projects?.forEach(p => {
    projectMap[p.project_number] = p.id;
  });
  
  // Create missing projects first
  const missingProjectNumbers = ['25-15', '26-01', '26-02'];
  for (const pn of missingProjectNumbers) {
    if (!projectMap[pn]) {
      // Get a default client
      const { data: defaultClient } = await supabase
        .from('clients')
        .select('id')
        .limit(1)
        .single();
      
      const { data: newProj } = await supabase
        .from('projects')
        .insert({
          project_number: pn,
          name: `Project ${pn}`,
          client_id: defaultClient?.id,
          status: 'active'
        })
        .select('id, project_number')
        .single();
      
      if (newProj) {
        projectMap[newProj.project_number] = newProj.id;
        console.log('Created project:', pn);
      }
    }
  }
  
  // For employees without profiles, we'll generate UUIDs
  // This requires creating placeholder profile entries or using a different approach
  // Let's use a simpler approach: employee_id can be a generated UUID for each unique employee name
  
  const employeeUUIDs = {};
  const { v4: uuidv4 } = require('uuid');
  
  // First check if uuid is available, if not we'll use a hash
  function generateUUID(name) {
    // Simple hash-based UUID for consistency
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.slice(0, 12).padEnd(12, '0')}`;
  }
  
  // Map employee names to UUIDs (use existing profile ID if available)
  for (const name of employeeNames) {
    if (profileMap[name]) {
      employeeUUIDs[name] = profileMap[name];
    } else {
      employeeUUIDs[name] = generateUUID(name);
    }
  }
  console.log('\nEmployee UUIDs:', employeeUUIDs);
  
  // Build billable rates entries
  const billableRates = [];
  
  for (let i = 1; i < ratesData.length; i++) {
    const row = ratesData[i];
    const projectNumber = row[0];
    
    if (!projectNumber) continue;
    
    const projectId = projectMap[projectNumber];
    if (!projectId) {
      console.log('Skipping project (not found):', projectNumber);
      continue;
    }
    
    // For each employee, create a rate entry
    for (let col = 1; col <= 5; col++) {
      const empName = headerRow[col];
      const rate = row[col];
      
      if (!empName || !rate || rate === 0) continue;
      
      billableRates.push({
        project_id: projectId,
        employee_id: employeeUUIDs[empName],
        employee_name: empName,
        hourly_rate: Number(rate),
        effective_from: '2023-01-01'
      });
    }
  }
  
  console.log('\nBillable rates to import:', billableRates.length);
  
  // Insert rates one at a time to handle duplicates gracefully
  let inserted = 0;
  let errors = 0;
  
  for (const rate of billableRates) {
    const { data, error } = await supabase
      .from('billable_rates')
      .upsert(rate, { 
        onConflict: 'project_id,employee_id,effective_from',
        ignoreDuplicates: false 
      })
      .select('id');
    
    if (error) {
      errors++;
      if (errors <= 3) {
        console.error('Insert error:', error.message, rate);
      }
    } else {
      inserted++;
    }
  }
  
  console.log('\nInserted/updated', inserted, 'billable rate entries');
  console.log('Errors:', errors);
  
  // Final count
  const { count } = await supabase.from('billable_rates').select('*', { count: 'exact', head: true });
  console.log('Total billable rates in database:', count);
  
  // Show sample
  const { data: sample } = await supabase
    .from('billable_rates')
    .select('project_id, employee_name, hourly_rate')
    .limit(10);
  console.log('\nSample rates:', sample);
}

importBillableRates().catch(console.error);
