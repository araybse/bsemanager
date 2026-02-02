const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addMissingProjectsAndRates() {
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  const workbook = XLSX.readFile(filePath);
  
  // Get a default client
  const { data: defaultClient } = await supabase
    .from('clients')
    .select('id')
    .limit(1)
    .single();
  
  // Create missing projects
  const missingProjects = ['25-15', '26-01', '26-02'];
  
  for (const pn of missingProjects) {
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('project_number', pn)
      .single();
    
    if (!existing) {
      const { data: newProj, error } = await supabase
        .from('projects')
        .insert({
          project_number: pn,
          name: `Project ${pn}`,
          client_id: defaultClient?.id,
          status: 'active'
        })
        .select('id, project_number')
        .single();
      
      if (error) {
        console.error(`Error creating ${pn}:`, error.message);
      } else {
        console.log(`Created project: ${pn} (ID: ${newProj.id})`);
      }
    }
  }
  
  // Now add rates for these projects
  const ratesSheet = workbook.Sheets['Billable Rates Matrix'];
  const ratesData = XLSX.utils.sheet_to_json(ratesSheet, { header: 1 });
  const headerRow = ratesData[0];
  
  // Get updated project map
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number');
  
  const projectMap = {};
  projects?.forEach(p => {
    projectMap[p.project_number] = p.id;
  });
  
  // Get profile map
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name');
  
  const profileMap = {};
  profiles?.forEach(p => {
    profileMap[p.full_name] = p.id;
  });
  
  // Find and add rates for missing projects
  const employeeColumns = [];
  for (let col = 1; col <= 5; col++) {
    if (headerRow[col]) {
      employeeColumns.push({ col, name: headerRow[col] });
    }
  }
  
  const newRates = [];
  
  for (let i = 1; i < ratesData.length; i++) {
    const row = ratesData[i];
    const projectNumber = row[0];
    
    if (!missingProjects.includes(projectNumber)) continue;
    
    const projectId = projectMap[projectNumber];
    if (!projectId) continue;
    
    for (const emp of employeeColumns) {
      const rate = row[emp.col];
      if (!rate || rate === 0) continue;
      
      const employeeId = profileMap[emp.name];
      if (!employeeId) continue;
      
      newRates.push({
        project_id: projectId,
        employee_id: employeeId,
        employee_name: emp.name,
        hourly_rate: Number(rate),
        effective_from: '2023-01-01'
      });
    }
  }
  
  console.log('\nNew rates to add:', newRates.length);
  
  if (newRates.length > 0) {
    const { data, error } = await supabase
      .from('billable_rates')
      .insert(newRates)
      .select('id');
    
    if (error) {
      console.error('Insert error:', error.message);
    } else {
      console.log('Inserted', data.length, 'new rates');
    }
  }
  
  // Final count
  const { count } = await supabase.from('billable_rates').select('*', { count: 'exact', head: true });
  const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  
  console.log('\n=== Final Counts ===');
  console.log('Projects:', projCount);
  console.log('Billable Rates:', count);
}

addMissingProjectsAndRates().catch(console.error);
