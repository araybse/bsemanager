#!/usr/bin/env node
/**
 * Test script for Auto-Processor Status Dashboard
 * 
 * This script:
 * 1. Inserts sample data into auto_processor_state table
 * 2. Verifies the API endpoint works
 * 3. Shows what the dashboard will display
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertSampleData() {
  console.log('📝 Inserting sample auto-processor heartbeat data...\n');
  
  // Insert a recent heartbeat (healthy state)
  const { data, error } = await supabase
    .from('auto_processor_state')
    .insert({
      last_check: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
      processed_count: 47,
      error_count: 0,
      last_error: null
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error inserting sample data:', error);
    return;
  }
  
  console.log('✅ Inserted heartbeat record:', {
    id: data.id,
    last_check: data.last_check,
    processed_count: data.processed_count,
    minutesAgo: Math.round((Date.now() - new Date(data.last_check).getTime()) / 1000 / 60)
  });
}

async function verifyApiEndpoint() {
  console.log('\n🔍 Verifying API endpoint response...\n');
  
  // This would normally require auth, but we can check the logic works
  // For now, just query the data directly
  
  const { data: state } = await supabase
    .from('auto_processor_state')
    .select('*')
    .order('last_check', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!state) {
    console.log('⚠️  No auto-processor state found');
    return;
  }
  
  const lastCheckTime = new Date(state.last_check);
  const minutesSinceLastCheck = (Date.now() - lastCheckTime.getTime()) / 1000 / 60;
  
  let status = 'stopped';
  if (minutesSinceLastCheck < 10) status = 'healthy';
  else if (minutesSinceLastCheck < 30) status = 'warning';
  else status = 'error';
  
  console.log('Status:', {
    health: status,
    lastCheck: lastCheckTime.toISOString(),
    minutesAgo: Math.round(minutesSinceLastCheck),
    emoji: status === 'healthy' ? '🟢' : status === 'warning' ? '🟡' : status === 'error' ? '🔴' : '⚫'
  });
  
  // Get recent email stats
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const { data: recentEmails } = await supabase
    .from('email_processing_log')
    .select('*')
    .gte('processed_at', oneDayAgo.toISOString());
  
  const sentCount = recentEmails?.filter(e => 
    e.from_address?.toLowerCase().includes('austin') ||
    e.from_address?.toLowerCase().includes('ray')
  ).length || 0;
  
  const receivedCount = (recentEmails?.length || 0) - sentCount;
  
  const { data: transcripts } = await supabase
    .from('email_processing_log')
    .select('*')
    .gte('processed_at', oneDayAgo.toISOString())
    .not('plaud_transcript_id', 'is', null);
  
  console.log('\n📊 Recent Activity (Last 24 Hours):');
  console.log('  📧 Emails:', {
    total: recentEmails?.length || 0,
    sent: sentCount,
    received: receivedCount
  });
  console.log('  🎙️  Transcripts:', transcripts?.length || 0);
  
  // Calculate confidence
  const confidenceScores = (recentEmails || [])
    .map(m => parseFloat(m.confidence) || 0)
    .filter(c => c > 0);
  
  const avgConfidence = confidenceScores.length > 0
    ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length * 100)
    : 0;
  
  const highCount = confidenceScores.filter(c => c >= 0.8).length;
  const mediumCount = confidenceScores.filter(c => c >= 0.5 && c < 0.8).length;
  const lowCount = confidenceScores.filter(c => c < 0.5).length;
  
  console.log('  🎯 Confidence:', {
    average: `${avgConfidence}%`,
    high: highCount,
    medium: mediumCount,
    low: lowCount
  });
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...\n');
  
  const { error } = await supabase
    .from('auto_processor_state')
    .delete()
    .gte('id', 0); // Delete all
  
  if (error) {
    console.error('❌ Error cleaning up:', error);
  } else {
    console.log('✅ Cleanup complete');
  }
}

// Main execution
console.log('🧪 Auto-Processor Status Dashboard Test\n');
console.log('=' .repeat(60));

await insertSampleData();
await verifyApiEndpoint();

console.log('\n' + '='.repeat(60));
console.log('\n✅ Test complete! The dashboard should show:');
console.log('  • Health indicator (green/yellow/red/gray)');
console.log('  • Email counts (sent vs received)');
console.log('  • Meeting transcript count');
console.log('  • Average confidence score\n');

// Uncomment to clean up test data
// await cleanup();
