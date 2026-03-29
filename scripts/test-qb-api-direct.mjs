// Test if we can directly call the QB API from the deployed app

async function testQBAPI() {
  console.log('🧪 Testing QB API connectivity...\n');
  
  try {
    // Try to fetch QB settings from the app
    const response = await fetch('https://bsemanager.vercel.app/api/qb-time/test-connection', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('\nResponse data:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testQBAPI();
