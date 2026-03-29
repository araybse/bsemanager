// Trigger full sync after deployment
const baseUrl = 'https://bsemanager.vercel.app';

async function triggerSync() {
  console.log('🔄 Triggering full QB sync...\n');
  
  try {
    const response = await fetch(`${baseUrl}/api/qb-time/sync-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-sync-token': process.env.INTERNAL_SYNC_TOKEN || ''
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Sync completed successfully!\n');
      console.log('📊 Results:');
      console.log('  Duration:', Math.round(data.duration_ms / 1000), 'seconds');
      console.log('  Totals:', JSON.stringify(data.totals, null, 2));
      
      if (data.time_billing_update) {
        console.log('\n📅 Time Billing Update:');
        console.log('  Updated entries:', data.time_billing_update.updated);
        console.log('  Billed periods:', data.time_billing_update.billedPeriods?.join(', '));
      }
    } else {
      console.log('❌ Sync failed:', data.message);
    }
    
    return data;
  } catch (err) {
    console.error('❌ Error triggering sync:', err.message);
    throw err;
  }
}

triggerSync();
