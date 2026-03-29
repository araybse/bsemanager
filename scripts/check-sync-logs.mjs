import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ahpsnajqjosjasaqebpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocHNuYWpxam9zamFzYXFlYnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzEzNDYsImV4cCI6MjA4NjUwNzM0Nn0.lQoCSoveBS4gJOvg3ynsLhZzCc2KiZD0YpoVy2Yb_LA'
);

async function checkSyncLogs() {
  console.log('📋 Checking recent sync logs...\n');
  
  const { data: runs, error } = await supabase
    .from('sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error fetching logs:', error.message);
    return;
  }
  
  if (!runs || runs.length === 0) {
    console.log('No sync runs found');
    return;
  }
  
  console.log(`Found ${runs.length} recent sync runs:\n`);
  
  runs.forEach((run, i) => {
    const startTime = new Date(run.started_at).toLocaleString();
    const status = run.status;
    const domain = run.domain;
    
    console.log(`${i + 1}. ${domain} - ${status}`);
    console.log(`   Started: ${startTime}`);
    console.log(`   Imported: ${run.imported_count || 0}, Updated: ${run.updated_count || 0}, Errors: ${run.error_count || 0}`);
    
    if (run.error_summary) {
      console.log(`   Error: ${run.error_summary}`);
    }
    console.log('');
  });
}

checkSyncLogs();
