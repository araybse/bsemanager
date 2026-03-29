import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ahpsnajqjosjasaqebpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocHNuYWpxam9zamFzYXFlYnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzEzNDYsImV4cCI6MjA4NjUwNzM0Nn0.lQoCSoveBS4gJOvg3ynsLhZzCc2KiZD0YpoVy2Yb_LA'
);

async function checkQBSettings() {
  console.log('🔍 Checking QB settings in database...\n');
  
  const { data, error } = await supabase
    .from('qb_settings')
    .select('*')
    .single();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (!data) {
    console.log('❌ No QB settings found');
    return;
  }
  
  console.log('QB Settings:');
  console.log('  Realm ID:', data.realm_id);
  console.log('  Connected at:', data.connected_at);
  console.log('  Token expires at:', data.token_expires_at);
  console.log('  Updated at:', data.updated_at);
  
  // Check if token is expired
  const expiresAt = new Date(data.token_expires_at);
  const now = new Date();
  const isExpired = expiresAt < now;
  
  console.log('\n⏰ Token Status:');
  console.log('  Current time:', now.toISOString());
  console.log('  Expires at:', expiresAt.toISOString());
  console.log('  Is expired:', isExpired ? '❌ YES' : '✅ NO');
  
  if (isExpired) {
    const hoursAgo = Math.floor((now - expiresAt) / (1000 * 60 * 60));
    console.log(`  Expired ${hoursAgo} hours ago`);
  }
  
  console.log('\n📝 Access Token (first 20 chars):', data.access_token?.substring(0, 20) + '...');
  console.log('📝 Refresh Token (first 20 chars):', data.refresh_token?.substring(0, 20) + '...');
}

checkQBSettings();
