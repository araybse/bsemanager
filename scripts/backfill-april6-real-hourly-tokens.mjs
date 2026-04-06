#!/usr/bin/env node
/**
 * Backfill April 6, 2026 REAL Hourly API Cost Data from Claude Console CSV
 * 
 * Uses actual token counts by hour (UTC) and calculates precise costs.
 * MUCH better than the estimated distribution!
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// CSV file path - NEW hourly token data
const csvPath = '/Users/austinray/.openclaw/media/inbound/claude_api_tokens_2026_04_06---49a21a40-c54e-4e0a-9970-d949adb3f6db.csv';

console.log('📊 Backfilling April 6, 2026 REAL Hourly Token Data\n');

// Pricing per million tokens
const pricing = {
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    cache_write: 0.30,
    cache_read: 0.03
  },
  'claude-opus-4-5-20251101': {
    input: 15,
    output: 75,
    cache_write: 18.75,
    cache_read: 1.50
  },
  'claude-sonnet-4-20250514': {
    input: 3,
    output: 15,
    cache_write: 3.75,
    cache_read: 0.30
  },
  'claude-sonnet-4-5-20250929': {
    input: 3,
    output: 15,
    cache_write: 3.75,
    cache_read: 0.30
  }
};

// Model name mapping
const modelMap = {
  'claude-3-haiku-20240307': 'claude-haiku-3',
  'claude-opus-4-5-20251101': 'claude-opus-4-5',
  'claude-sonnet-4-20250514': 'claude-sonnet-4',
  'claude-sonnet-4-5-20250929': 'claude-sonnet-4-5'
};

// Agent name mapping by hour (EST) based on known activity
const agentsByHour = {
  23: 'Max', // 11 PM EST = 04:00 UTC (Apr 5 night, heartbeat)
  0: 'Sebastian', // Midnight EST = 05:00 UTC (email backfill)
  1: 'Sophia', // 1 AM EST = 06:00 UTC (UI improvements)
  2: 'Oliver', // 2 AM EST = 07:00 UTC (more work)
  3: 'Olivia', // 3 AM EST = 08:00 UTC (cash flow)
  4: 'Emma', // 4 AM EST = 09:00 UTC (heavy activity)
  5: 'Max', // 5 AM EST = 10:00 UTC (ongoing)
  6: 'Henry', // 6 AM EST = 11:00 UTC (ongoing)
  7: 'Max', // 7 AM EST = 12:00 UTC (daytime)
  8: 'Max', // 8 AM EST = 13:00 UTC (daytime)
  9: 'Max', // 9 AM EST = 14:00 UTC (daytime)
  10: 'Max', // 10 AM EST = 15:00 UTC (current)
};

// Step 1: Parse CSV
console.log('Step 1: Parsing CSV with hourly token data...');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const records = parse(csvContent, { columns: true, skip_empty_lines: true });

console.log(`Found ${records.length} hourly token records\n`);

// Step 2: Calculate costs from tokens
console.log('Step 2: Calculating costs from token counts...');

const hourlyRecords = [];
let totalCost = 0;

records.forEach(record => {
  const modelVersion = record.model_version;
  const modelPricing = pricing[modelVersion];
  
  if (!modelPricing) {
    console.warn(`⚠️  Unknown model: ${modelVersion}`);
    return;
  }
  
  // Parse token counts
  const inputTokens = parseInt(record.usage_input_tokens_no_cache) || 0;
  const cacheWriteTokens = parseInt(record.usage_input_tokens_cache_write_5m) || 0;
  const cacheReadTokens = parseInt(record.usage_input_tokens_cache_read) || 0;
  const outputTokens = parseInt(record.usage_output_tokens) || 0;
  
  // Calculate cost
  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * modelPricing.cache_write;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * modelPricing.cache_read;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;
  
  const cost = inputCost + cacheWriteCost + cacheReadCost + outputCost;
  totalCost += cost;
  
  // Parse UTC hour and convert to EST
  const utcTimestamp = record.usage_date_utc; // "2026-04-06 00:00"
  const utcHour = parseInt(utcTimestamp.split(' ')[1].split(':')[0]);
  const estHour = (utcHour - 5 + 24) % 24; // Convert UTC to EST
  
  // Determine the correct date in EST
  const isEarlyMorning = utcHour < 5; // 00:00-04:00 UTC = previous day EST
  const estDate = isEarlyMorning ? '2026-04-05' : '2026-04-06';
  
  // Create record
  hourlyRecords.push({
    usage_date: '2026-04-06', // Keep as April 6 for consistency with billing
    created_at: `2026-04-06 ${utcHour.toString().padStart(2, '0')}:30:00+00`, // UTC timestamp
    session_key: `agent:main:real:${utcHour}:${modelVersion}`,
    session_type: 'main',
    agent_name: agentsByHour[estHour] || 'Various',
    model: modelMap[modelVersion],
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_write_tokens: cacheWriteTokens,
    cache_read_tokens: cacheReadTokens,
    total_tokens: inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens,
    estimated_cost_usd: parseFloat(cost.toFixed(4)),
    session_duration_ms: null,
    metadata: {
      utc_hour: utcHour,
      est_hour: estHour,
      source: 'claude_console_hourly_tokens'
    }
  });
});

console.log(`   Calculated costs for ${hourlyRecords.length} records`);
console.log(`   Total cost: $${totalCost.toFixed(2)}\n`);

// Step 3: Delete existing April 6 data
console.log('Step 3: Deleting old April 6 data (estimated distribution)...');
const { data: beforeData } = await supabase
  .from('api_costs_realtime')
  .select('estimated_cost_usd')
  .eq('usage_date', '2026-04-06');

const beforeTotal = beforeData?.reduce((sum, r) => sum + (r.estimated_cost_usd || 0), 0) || 0;
console.log(`   Current DB total: $${beforeTotal.toFixed(2)}`);

const { error: deleteError } = await supabase
  .from('api_costs_realtime')
  .delete()
  .eq('usage_date', '2026-04-06');

if (deleteError) {
  console.error('❌ Error deleting old data:', deleteError);
  process.exit(1);
}
console.log('   ✅ Deleted old estimated data\n');

// Step 4: Insert real hourly data
console.log('Step 4: Inserting REAL hourly token data...');

// Remove metadata field (table doesn't support it)
const recordsToInsert = hourlyRecords.map(({ metadata, ...rest }) => rest);

const { data: insertData, error: insertError } = await supabase
  .from('api_costs_realtime')
  .insert(recordsToInsert)
  .select();

if (insertError) {
  console.error('❌ Error inserting data:', insertError);
  console.error('First record:', recordsToInsert[0]);
  process.exit(1);
}

console.log(`   ✅ Inserted ${insertData.length} real hourly records\n`);

// Step 5: Verify results
console.log('Step 5: Verifying backfill...');
const { data: afterData, error: afterError } = await supabase
  .from('api_costs_realtime')
  .select('estimated_cost_usd, created_at, model, agent_name')
  .eq('usage_date', '2026-04-06')
  .order('created_at', { ascending: true });

if (afterError) {
  console.error('❌ Error verifying data:', afterError);
  process.exit(1);
}

const afterTotal = afterData.reduce((sum, r) => sum + (r.estimated_cost_usd || 0), 0);

console.log(`   New DB total for April 6: $${afterTotal.toFixed(2)}`);
console.log(`   Record count: ${afterData.length}`);
console.log('');

// Hourly breakdown
console.log('📊 Hourly Breakdown (UTC → EST):');
const hourlyTotals = {};
afterData.forEach(r => {
  const timestamp = new Date(r.created_at);
  const hour = timestamp.getUTCHours();
  const estHour = (hour - 5 + 24) % 24;
  const key = `${hour.toString().padStart(2, '0')} UTC (${estHour.toString().padStart(2, '0')} EST)`;
  if (!hourlyTotals[key]) hourlyTotals[key] = 0;
  hourlyTotals[key] += r.estimated_cost_usd;
});

Object.entries(hourlyTotals).forEach(([hour, cost]) => {
  console.log(`   ${hour} → $${cost.toFixed(2)}`);
});
console.log('');

// Model breakdown
console.log('📊 Model Breakdown:');
const dbModelCosts = {};
afterData.forEach(r => {
  if (!dbModelCosts[r.model]) dbModelCosts[r.model] = 0;
  dbModelCosts[r.model] += r.estimated_cost_usd;
});
Object.entries(dbModelCosts).sort((a, b) => b[1] - a[1]).forEach(([model, cost]) => {
  const pct = (cost / afterTotal * 100).toFixed(1);
  console.log(`   ${model.padEnd(20)} $${cost.toFixed(2).padStart(7)} (${pct.padStart(4)}%)`);
});
console.log('');

// Agent breakdown
console.log('🤖 Agent Activity:');
const agentCosts = {};
afterData.forEach(r => {
  if (!agentCosts[r.agent_name]) agentCosts[r.agent_name] = 0;
  agentCosts[r.agent_name] += r.estimated_cost_usd;
});
Object.entries(agentCosts).sort((a, b) => b[1] - a[1]).forEach(([agent, cost]) => {
  const pct = (cost / afterTotal * 100).toFixed(1);
  console.log(`   ${agent.padEnd(15)} $${cost.toFixed(2).padStart(7)} (${pct.padStart(4)}%)`);
});
console.log('');

// Final summary
console.log('✅ REAL HOURLY DATA BACKFILL COMPLETE\n');
console.log('📈 Results:');
console.log(`   Before: $${beforeTotal.toFixed(2)} (estimated distribution)`);
console.log(`   After:  $${afterTotal.toFixed(2)} (real token counts)`);
console.log(`   CSV:    $${totalCost.toFixed(2)}`);
console.log('');

const diff = Math.abs(afterTotal - totalCost);
if (diff > 0.50) {
  console.log(`⚠️  WARNING: DB total differs from CSV by $${diff.toFixed(2)}`);
} else {
  console.log('✅ DB total matches calculated cost from tokens!\n');
}

console.log('🎯 Next Steps:');
console.log('   1. Refresh the dashboard at http://localhost:3000/api-costs');
console.log('   2. Verify "Today\'s Spending" shows actual cost');
console.log('   3. Check hourly breakdown shows real activity peaks');
console.log('   4. Confirm model/agent breakdowns are accurate');
console.log('');
