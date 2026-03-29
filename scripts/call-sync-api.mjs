// Call sync API directly with admin credentials

async function getAuthToken() {
  console.log('🔐 Getting auth token...');
  
  const loginResponse = await fetch('https://bsemanager.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aray@blackstoneeng.com',
      password: 'BsE#2023admin'
    })
  });
  
  const loginData = await loginResponse.json();
  if (!loginData.session) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  
  console.log('✅ Logged in\n');
  return loginData.session.access_token;
}

async function triggerSync(token) {
  console.log('🔄 Triggering sync...\n');
  
  const response = await fetch('https://bsemanager.vercel.app/api/qb-time/sync-all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  console.log('📊 Sync Response:\n');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.success) {
    console.log('\n✅ Sync completed successfully!');
    
    if (data.time_billing_update) {
      console.log('\n📅 Time Billing Update:');
      console.log('  Updated:', data.time_billing_update.updated, 'entries');
      console.log('  Billed periods:', data.time_billing_update.billedPeriods?.join(', ') || 'none');
    }
  } else {
    console.log('\n❌ Sync failed:', data.message || data.error);
  }
  
  return data;
}

async function main() {
  try {
    const token = await getAuthToken();
    await triggerSync(token);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

main();
