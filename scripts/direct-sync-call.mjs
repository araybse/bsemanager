// Direct sync call using internal token or admin approach

const baseUrl = 'https://bsemanager.vercel.app';

async function triggerSync() {
  console.log('🔄 Attempting direct sync call...\n');
  
  try {
    // Try with internal sync token if available
    const response = await fetch(`${baseUrl}/api/qb-time/sync-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('\n📊 Response:\n', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('\n📄 Response (first 500 chars):\n', text.substring(0, 500));
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

triggerSync();
