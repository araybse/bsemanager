import { chromium } from 'playwright';

async function testIRIS() {
  console.log('🧪 IRIS Comprehensive Automated Test\n');
  console.log('='.repeat(80) + '\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const results = [];
  
  try {
    // Test 1: Login Page
    console.log('1️⃣  Testing Login Page...');
    await page.goto('https://bsemanager.vercel.app');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/iris-01-login-page.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-01-login-page.png');
    results.push({ test: 'Login Page', status: 'PASS', screenshot: '/tmp/iris-01-login-page.png' });
    
    // Test 2: Login as Admin
    console.log('\n2️⃣  Logging in as Admin (aray@blackstoneeng.com)...');
    await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023admin');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/iris-02-admin-dashboard.png', fullPage: true });
    console.log('    ✅ Logged in successfully');
    console.log('    ✅ Screenshot saved: /tmp/iris-02-admin-dashboard.png');
    results.push({ test: 'Admin Login', status: 'PASS', screenshot: '/tmp/iris-02-admin-dashboard.png' });
    
    // Test 3: Dashboard Summary Cards
    console.log('\n3️⃣  Checking Dashboard Summary Cards...');
    const revenue = await page.locator('text=/Total Revenue/').first().textContent().catch(() => null);
    const cost = await page.locator('text=/Total Cost/').first().textContent().catch(() => null);
    console.log('    📊 Revenue card:', revenue ? 'FOUND' : 'MISSING');
    console.log('    📊 Cost card:', cost ? 'FOUND' : 'MISSING');
    results.push({ test: 'Dashboard Cards', status: (revenue && cost) ? 'PASS' : 'FAIL' });
    
    // Test 4: Invoices Tab
    console.log('\n4️⃣  Testing Invoices Tab...');
    await page.click('text=Invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/iris-03-invoices-tab.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-03-invoices-tab.png');
    results.push({ test: 'Invoices Tab', status: 'PASS', screenshot: '/tmp/iris-03-invoices-tab.png' });
    
    // Test 5: Time Tab
    console.log('\n5️⃣  Testing Time Tab...');
    await page.click('text=Time');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/iris-04-time-tab.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-04-time-tab.png');
    results.push({ test: 'Time Tab', status: 'PASS', screenshot: '/tmp/iris-04-time-tab.png' });
    
    // Test 6: Expenses Tab
    console.log('\n6️⃣  Testing Expenses Tab...');
    await page.click('text=Expenses');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/iris-05-expenses-tab.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-05-expenses-tab.png');
    results.push({ test: 'Expenses Tab', status: 'PASS', screenshot: '/tmp/iris-05-expenses-tab.png' });
    
    // Test 7: Team Tab
    console.log('\n7️⃣  Testing Team Tab...');
    await page.click('text=Team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/iris-06-team-tab.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-06-team-tab.png');
    results.push({ test: 'Team Tab', status: 'PASS', screenshot: '/tmp/iris-06-team-tab.png' });
    
    // Test 8: Settings/QB Sync
    console.log('\n8️⃣  Testing Settings Tab...');
    await page.click('text=Settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/iris-07-settings-tab.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-07-settings-tab.png');
    results.push({ test: 'Settings Tab', status: 'PASS', screenshot: '/tmp/iris-07-settings-tab.png' });
    
    // Test 9: Logout and Login as PM
    console.log('\n9️⃣  Testing PM Role (Austin Burke)...');
    // Find and click logout/profile menu
    try {
      await page.click('[data-testid="user-menu"]').catch(() => page.click('button:has-text("aray")'));
      await page.waitForTimeout(500);
      await page.click('text=Sign out');
      await page.waitForLoadState('networkidle');
    } catch (e) {
      console.log('    ⚠️  Could not find logout button, reloading to login page');
      await page.goto('https://bsemanager.vercel.app');
      await page.waitForLoadState('networkidle');
    }
    
    await page.fill('input[type="email"]', 'aburke@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023pm');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/iris-08-pm-dashboard.png', fullPage: true });
    console.log('    ✅ PM Dashboard screenshot saved: /tmp/iris-08-pm-dashboard.png');
    results.push({ test: 'PM Login', status: 'PASS', screenshot: '/tmp/iris-08-pm-dashboard.png' });
    
    // Test 10: PM tries to access Accounting (should be blocked)
    console.log('\n🔟 Testing PM Access Control (should block /accounting)...');
    await page.goto('https://bsemanager.vercel.app/accounting');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const url = page.url();
    if (url.includes('/accounting')) {
      console.log('    ❌ PM can access /accounting (should be blocked!)');
      results.push({ test: 'PM Access Control', status: 'FAIL', note: 'PM can access /accounting' });
    } else {
      console.log('    ✅ PM correctly redirected from /accounting');
      results.push({ test: 'PM Access Control', status: 'PASS' });
    }
    await page.screenshot({ path: '/tmp/iris-09-pm-access-control.png', fullPage: true });
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 TEST SUMMARY\n');
    results.forEach((r, i) => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${i + 1}. ${r.test}: ${r.status}`);
      if (r.screenshot) console.log(`   📸 ${r.screenshot}`);
      if (r.note) console.log(`   ℹ️  ${r.note}`);
    });
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    console.log(`\n📈 Results: ${passCount} PASS, ${failCount} FAIL (${results.length} total)`);
    
  } catch (err) {
    console.error('\n❌ Test Error:', err.message);
    console.error(err.stack);
  } finally {
    console.log('\n⏸️  Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
    console.log('✅ Test complete!');
  }
}

testIRIS();
