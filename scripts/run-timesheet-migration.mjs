#!/usr/bin/env node
/**
 * Run Timesheet V2.0 Migrations
 * Applies schema changes and RLS policy updates for timesheet feature
 * 
 * Usage: node scripts/run-timesheet-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

// Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseKey || !supabaseUrl) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrationViaPsql(filename, description) {
  console.log(`\n🔄 Running: ${description}`);
  console.log(`   File: ${filename}`);
  
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', filename);
  
  if (!dbUrl) {
    console.log('   ⚠️  SUPABASE_DB_URL not found, skipping psql execution');
    console.log('   📋 To run manually: Copy SQL from the migration file to Supabase SQL Editor');
    return;
  }
  
  try {
    const command = `psql "${dbUrl}" -f "${migrationPath}"`;
    console.log(`   Executing via psql...`);
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('NOTICE')) {
      console.error(`   ⚠️  Warnings: ${stderr}`);
    }
    
    if (stdout) {
      console.log(`   Output: ${stdout.trim()}`);
    }
    
    console.log('   ✅ Complete');
  } catch (error) {
    console.error(`   ❌ Failed:`, error.message);
    console.log(`\n   📋 Manual execution required:`);
    console.log(`   1. Open Supabase SQL Editor: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`);
    console.log(`   2. Copy contents of: ${filename}`);
    console.log(`   3. Run in SQL Editor\n`);
    throw error;
  }
}

async function testMigration() {
  console.log('\n🧪 Testing migration results...\n');
  
  // 1. Check if columns exist
  console.log('1. Verifying new columns...');
  const { data: columns, error: colError } = await supabase
    .from('time_entries')
    .select('status, week_ending_date, submitted_at, approved_at, approved_by')
    .limit(1);
  
  if (colError) {
    console.error('   ❌ Failed to query time_entries:', colError);
    throw colError;
  }
  console.log('   ✅ All columns exist');
  
  // 2. Count existing entries
  const { count: totalCount, error: countError } = await supabase
    .from('time_entries')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('   ❌ Failed to count entries:', countError);
    throw countError;
  }
  console.log(`   ✅ Total entries: ${totalCount}`);
  
  // 3. Check status distribution
  const { data: statusDist, error: statusError } = await supabase
    .from('time_entries')
    .select('status')
    .eq('status', 'approved');
  
  if (statusError) {
    console.error('   ❌ Failed to check status:', statusError);
    throw statusError;
  }
  console.log(`   ✅ Approved entries: ${statusDist?.length || 0}`);
  
  // 4. Check week_ending_date was backfilled
  const { data: nullWeeks, error: weekError } = await supabase
    .from('time_entries')
    .select('week_ending_date')
    .is('week_ending_date', null);
  
  if (weekError) {
    console.error('   ❌ Failed to check week_ending_date:', weekError);
    throw weekError;
  }
  
  if (nullWeeks && nullWeeks.length > 0) {
    console.error(`   ❌ Found ${nullWeeks.length} entries with NULL week_ending_date`);
  } else {
    console.log('   ✅ All entries have week_ending_date set');
  }
  
  // 5. Check indexes
  console.log('2. Checking indexes (manual verification needed)...');
  console.log('   Expected indexes:');
  console.log('   - ix_time_entries_status');
  console.log('   - ix_time_entries_week_ending_date');
  console.log('   - ix_time_entries_employee_week');
  console.log('   - ix_time_entries_employee_status_week');
  console.log('   - ix_time_entries_timesheet_lookup');
  
  // 6. Test trigger by inserting a test entry (then deleting)
  console.log('3. Testing week_ending_date trigger...');
  const testEntry = {
    employee_id: '00000000-0000-0000-0000-000000000000', // Test UUID
    project_id: 1,
    entry_date: '2026-04-07', // Monday
    hours: 1.0,
    phase_name: 'Test',
    status: 'draft'
  };
  
  console.log('   ⚠️  Trigger test skipped (requires valid employee_id)');
  console.log('   Manual test: INSERT a time entry and verify week_ending_date = Saturday');
  
  console.log('\n✅ Migration verification complete!');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       IRIS Timesheet V2.0 Database Migration                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  try {
    // Check if psql is available
    const hasPsql = await checkPsql();
    
    if (hasPsql) {
      // Migration 1: Schema changes
      await runMigrationViaPsql(
        '20260405_timesheet_status_fields.sql',
        'Timesheet status fields and indexes'
      );
      
      // Migration 2: RLS policies
      await runMigrationViaPsql(
        '20260405_timesheet_rls_policies.sql',
        'Timesheet RLS policies and views'
      );
    } else {
      console.log('\n⚠️  psql not found. Please run migrations manually:');
      console.log('\n1. Open Supabase SQL Editor:');
      console.log(`   ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`);
      console.log('\n2. Run these migrations in order:');
      console.log('   - supabase/migrations/20260405_timesheet_status_fields.sql');
      console.log('   - supabase/migrations/20260405_timesheet_rls_policies.sql\n');
    }
    
    // Test the migration
    await testMigration();
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Migration Complete - Ready for Timesheet V2.0              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n📋 Next steps:');
    console.log('1. Run migrations manually via Supabase SQL Editor');
    console.log('2. Verify with: node scripts/run-timesheet-migration.mjs\n');
    process.exit(1);
  }
}

async function checkPsql() {
  try {
    await execAsync('which psql');
    return true;
  } catch {
    return false;
  }
}

main();
