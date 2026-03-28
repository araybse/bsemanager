import { chromium } from 'playwright';

async function testIRIS() {
  console.log('🧪 Starting IRIS Comprehensive Test\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Test 1: Login Page
    console.log('1️⃣ Testing Login Page...');
    await page.goto('https://bsemanager.vercel.app');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/iris-test-01-login.png', fullPage: true });
    console.log('   ✅ Login page screenshot saved');
    console.log('   📸 /tmp/iris-test-01-login.png\n');
    
    await page.waitForTimeout(60000); // Wait 60 seconds for manual interaction
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await browser.close();
  }
}

testIRIS();
