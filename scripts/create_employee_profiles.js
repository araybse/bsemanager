const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createEmployeeProfiles() {
  const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
  const workbook = XLSX.readFile(filePath);
  
  // Get employee info from the Billable Rates Matrix sheet
  const ratesSheet = workbook.Sheets['Billable Rates Matrix'];
  const ratesData = XLSX.utils.sheet_to_json(ratesSheet, { header: 1 });
  
  // Employee info is in columns 7 and 8 (Employee name and Title)
  const employeeInfo = {};
  for (let i = 1; i < ratesData.length; i++) {
    const row = ratesData[i];
    if (row[7] && row[8]) {
      employeeInfo[row[7]] = row[8];
    }
  }
  console.log('Employee titles from sheet:', employeeInfo);
  
  // Get existing profiles
  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, email');
  
  const existingNames = new Set(existingProfiles?.map(p => p.full_name) || []);
  console.log('\nExisting profiles:', Array.from(existingNames));
  
  // Employees we need (from the rate matrix header)
  const employeesNeeded = [
    { name: 'Austin Burke', id: '11111111-1111-1111-1111-111111111111' },
    { name: 'Wesley Koning', id: '22222222-2222-2222-2222-222222222222' },
    { name: 'Morgan Wilson', id: '33333333-3333-3333-3333-333333333333' },
    { name: 'Arber Meta', id: '44444444-4444-4444-4444-444444444444' },
  ];
  
  // Create missing profiles
  const profilesToCreate = [];
  for (const emp of employeesNeeded) {
    if (!existingNames.has(emp.name)) {
      profilesToCreate.push({
        id: emp.id,
        full_name: emp.name,
        email: `${emp.name.toLowerCase().replace(' ', '.')}@blackstoneeng.com`,
        title: employeeInfo[emp.name] || 'Employee',
        role: 'employee',
        is_active: true
      });
    }
  }
  
  console.log('\nProfiles to create:', profilesToCreate.length);
  
  if (profilesToCreate.length > 0) {
    for (const profile of profilesToCreate) {
      console.log(`Creating profile: ${profile.full_name} (${profile.id})`);
      const { error } = await supabase
        .from('profiles')
        .insert(profile);
      
      if (error) {
        console.error(`Error creating ${profile.full_name}:`, error.message);
      } else {
        console.log(`  Created: ${profile.full_name}`);
      }
    }
  }
  
  // Show all profiles
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, title, role');
  
  console.log('\n=== All Profiles ===');
  allProfiles?.forEach(p => {
    console.log(`  ${p.full_name} (${p.role}) - ${p.title || 'No title'}`);
  });
}

createEmployeeProfiles().catch(console.error);
