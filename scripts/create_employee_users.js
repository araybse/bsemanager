const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createEmployeeUsers() {
  // Employee info from the Billing Console
  const employees = [
    { 
      name: 'Austin Burke', 
      email: 'aburke@blackstoneeng.com',
      title: 'Project Manager',
      role: 'project_manager'
    },
    { 
      name: 'Wesley Koning', 
      email: 'wkoning@blackstoneeng.com',
      title: 'Project Manager',
      role: 'project_manager'
    },
    { 
      name: 'Morgan Wilson', 
      email: 'mwilson@blackstoneeng.com',
      title: 'Project Inspector',
      role: 'employee'
    },
    { 
      name: 'Arber Meta', 
      email: 'ameta@blackstoneeng.com',
      title: 'Senior Designer',
      role: 'employee'
    },
  ];

  console.log('Creating employee users...\n');

  const createdUsers = [];

  for (const emp of employees) {
    console.log(`Creating user: ${emp.name} (${emp.email})`);
    
    // Create auth user with a temporary password
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emp.email,
      password: 'TempPassword123!', // They'll need to reset this
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: emp.name
      }
    });

    if (authError) {
      console.error(`  Auth error: ${authError.message}`);
      continue;
    }

    console.log(`  Created auth user: ${authData.user.id}`);

    // Create profile entry
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: emp.email,
        full_name: emp.name,
        title: emp.title,
        role: emp.role,
        is_active: true
      });

    if (profileError) {
      console.error(`  Profile error: ${profileError.message}`);
    } else {
      console.log(`  Created profile`);
      createdUsers.push({
        name: emp.name,
        email: emp.email,
        id: authData.user.id
      });
    }
  }

  console.log('\n=== Summary ===');
  console.log('Created users:');
  createdUsers.forEach(u => {
    console.log(`  ${u.name}: ${u.email} (ID: ${u.id})`);
  });
  
  console.log('\nTemporary password for all users: TempPassword123!');
  console.log('Users should reset their password on first login.');

  // Show all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, title, role')
    .order('full_name');

  console.log('\n=== All Profiles ===');
  profiles?.forEach(p => {
    console.log(`  ${p.full_name} (${p.role}): ${p.email}`);
  });

  return createdUsers;
}

createEmployeeUsers().catch(console.error);
