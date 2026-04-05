#!/usr/bin/env node
/**
 * Apply Timesheet Migrations via Supabase REST API
 * Executes SQL migrations directly through Supabase PostgREST
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
import dotenv from 'dotenv';
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

async function executeSql(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return await response.json();
}

async function runMigration(filename, description) {
  console.log(`\n🔄 ${description}`);
  console.log(`   File: ${filename}`);
  
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', filename);
  const sql = readFileSync(migrationPath, 'utf8');
  
  try {
    // Note: Supabase doesn't have exec_sql by default
    // We need to use psql or SQL Editor
    console.log('   ⚠️  Direct SQL execution not available via REST API');
    console.log('   📋 Migration SQL ready at: ' + migrationPath);
    return { manual: true };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    throw error;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       IRIS Timesheet V2.0 Migration Preparation               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📋 Migration files created and ready for execution:\n');
  console.log('   1. supabase/migrations/20260405_timesheet_status_fields.sql');
  console.log('   2. supabase/migrations/20260405_timesheet_rls_policies.sql\n');
  
  console.log('🔧 To execute migrations:\n');
  console.log('   Option A (Recommended): Supabase SQL Editor');
  console.log('   -----------------------------------------');
  console.log('   1. Open: https://supabase.com/dashboard/project/lqlyargzteskhsddbjpa/sql/new');
  console.log('   2. Copy/paste each migration file');
  console.log('   3. Click "Run"\n');
  
  console.log('   Option B: psql Command Line');
  console.log('   ---------------------------');
  console.log('   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260405_timesheet_status_fields.sql');
  console.log('   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260405_timesheet_rls_policies.sql\n');
  
  console.log('📖 Full guide: TIMESHEET_MIGRATION_GUIDE.md\n');
  
  console.log('✅ Migration preparation complete!\n');
}

main();
