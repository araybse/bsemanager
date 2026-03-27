import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runTests() {
  console.log('🔍 BSE Manager Backend Test Suite');
  console.log('==================================\n');
  
  let passed = 0, failed = 0, warnings = 0;

  // Test 1: Database Connection
  console.log('1️⃣ Database Connection');
  try {
    const { count, error } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log(`   ✅ Connected (${count} projects)\n`);
    passed++;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}\n`);
    failed++;
    return { passed, failed, warnings };
  }

  // Test 2: RLS Enforcement
  console.log('2️⃣ RLS Policies (Unauthenticated)');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`   ✅ RLS blocking access (${error.code || error.message})\n`);
      passed++;
    } else if (data?.length > 0) {
      console.log(`   ⚠️  WARNING: Got data without auth\n`);
      warnings++;
    }
  } catch (error) {
    console.log(`   ❌ Test error: ${error.message}\n`);
    failed++;
  }

  // Test 3: Critical Tables
  console.log('3️⃣ Critical Tables');
  const tables = [
    'projects', 'profiles', 'time_entries', 'invoices',
    'project_team_assignments', 'contracts', 'contract_phases',
    'clients', 'billable_rates', 'expenses', 'invoice_billables'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error && !error.message.includes('row-level security') && error.code !== '42501') {
        console.log(`   ❌ ${table}: ${error.message}`);
        failed++;
      } else {
        console.log(`   ✅ ${table} (${count !== null ? count + ' rows' : 'RLS protected'})`);
        passed++;
      }
    } catch (error) {
      console.log(`   ❌ ${table}: ${error.message}`);
      failed++;
    }
  }
  console.log('');

  // Test 4: Data Queries (public data)
  console.log('4️⃣ Public Data Accessibility');
  
  // Try to get projects (should be RLS protected)
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('project_number, name')
      .order('project_number', { ascending: false })
      .limit(3);
    
    if (error && error.code === '42501') {
      console.log(`   ✅ Projects protected by RLS`);
      passed++;
    } else if (data) {
      console.log(`   ⚠️  WARNING: Got ${data.length} projects without auth`);
      console.log(`      Latest: ${data.map(p => p.project_number).join(', ')}`);
      warnings++;
    }
  } catch (error) {
    console.log(`   ⚠️  Query error: ${error.message}`);
    warnings++;
  }
  console.log('');

  // Test 5: Migrations
  console.log('5️⃣ Migration Files');
  try {
    const migrationsDir = path.join(__dirname, 'supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    console.log(`   ✅ ${files.length} migration files`);
    
    // Check for key migrations
    const rlsMigration = files.find(f => f.includes('role_based_visibility'));
    const teamMigration = files.find(f => f.includes('project_team_assignments'));
    const billablesMigration = files.find(f => f.includes('invoice_billables'));
    
    if (rlsMigration) {
      console.log(`   ✅ RLS migration: ${rlsMigration}`);
      passed++;
    } else {
      console.log(`   ⚠️  RLS migration not found`);
      warnings++;
    }
    
    if (teamMigration) {
      console.log(`   ✅ Team assignments: ${teamMigration}`);
      passed++;
    }
    
    if (billablesMigration) {
      console.log(`   ✅ Invoice billables: ${billablesMigration}`);
      passed++;
    }
  } catch (error) {
    console.log(`   ⚠️  Could not read migrations: ${error.message}`);
    warnings++;
  }
  console.log('');

  return { passed, failed, warnings };
}

runTests().then(({ passed, failed, warnings }) => {
  console.log('📊 Summary');
  console.log('==========');
  console.log(`✅ Passed:   ${passed}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}\n`);

  if (failed === 0 && warnings === 0) {
    console.log('🎉 All tests passed! Backend is healthy.');
    process.exit(0);
  } else if (failed === 0) {
    console.log('✅ Critical tests passed. Review warnings above.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Review errors above.');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
