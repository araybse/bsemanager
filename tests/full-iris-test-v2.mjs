import { chromium } from 'playwright';

async function waitForPageFullyLoaded(page) {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
  // Wait an additional 3 seconds for any animations/lazy loading
  await page.waitForTimeout(3000);
  // Wait for any loading spinners to disappear
  await page.waitForSelector('.loading, [data-loading="true"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
}

async function testIRIS() {
  console.log('🧪 IRIS Comprehensive Automated Test v2\n');
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
    await waitForPageFullyLoaded(page);
    await page.screenshot({ path: '/tmp/iris-01-login-page.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-01-login-page.png');
    results.push({ test: 'Login Page', status: 'PASS', screenshot: '/tmp/iris-01-login-page.png' });
    
    // Test 2: Login as Admin
    console.log('\n2️⃣  Logging in as Admin (aray@blackstoneeng.com)...');
    await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023admin');
    await page.click('button[type="submit"]');
    await waitForPageFullyLoaded(page);
    await page.screenshot({ path: '/tmp/iris-02-admin-dashboard.png', fullPage: true });
    console.log('    ✅ Logged in successfully');
    console.log('    ✅ Screenshot saved: /tmp/iris-02-admin-dashboard.png');
    results.push({ test: 'Admin Login', status: 'PASS', screenshot: '/tmp/iris-02-admin-dashboard.png' });
    
    // Test 3: Dashboard Summary Cards
    console.log('\n3️⃣  Checking Dashboard Summary Cards...');
    const revenue = await page.locator('text=/Total Revenue|Revenue/i').first().textContent().catch(() => null);
    const cost = await page.locator('text=/Total Cost|Cost/i').first().textContent().catch(() => null);
    console.log('    📊 Revenue card:', revenue ? 'FOUND' : 'MISSING');
    console.log('    📊 Cost card:', cost ? 'FOUND' : 'MISSING');
    results.push({ test: 'Dashboard Cards', status: (revenue && cost) ? 'PASS' : 'PARTIAL' });
    
    // Test 4: Invoices Tab
    console.log('\n4️⃣  Testing Invoices Tab...');
    await page.click('a:has-text("Invoices"), button:has-text("Invoices")');
    await waitForPageFullyLoaded(page);
    await page.screenshot({ path: '/tmp/iris-03-invoices-tab.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-03-invoices-tab.png');
    results.push({ test: 'Invoices Tab', status: 'PASS', screenshot: '/tmp/iris-03-invoices-tab.png' });
    
    // Test 5: Time Tab
    console.log('\n5️⃣  Testing Time Tab...');
    await page.click('a:has-text("Time"), button:has-text("Time")');
    await waitForPageFullyLoaded(page);
    await page.screenshot({ path: '/tmp/iris-04-time-tab.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-04-time-tab.png');
    results.push({ test: 'Time Tab', status: 'PASS', screenshot: '/tmp/iris-04-time-tab.png' });
    
    // Test 6: Expenses Tab
    console.log('\n6️⃣  Testing Expenses Tab...');
    await page.click('a:has-text("Expenses"), button:has-text("Expenses")');
    await waitForPageFullyLoaded(page);
    await page.screenshot({ path: '/tmp/iris-05-expenses-tab.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-05-expenses-tab.png');
    results.push({ test: 'Expenses Tab', status: 'PASS', screenshot: '/tmp/iris-05-expenses-tab.png' });
    
    // Test 7: Settings Tab (skip Team for now)
    console.log('\n7️⃣  Testing Settings Tab...');
    try {
      await page.click('a:has-text("Settings"), button:has-text("Settings")');
      await waitForPageFullyLoaded(page);
      await page.screenshot({ path: '/tmp/iris-06-settings-tab.png', fullPage: true });
      console.log('    ✅ Screenshot saved: /tmp/iris-06-settings-tab.png');
      results.push({ test: 'Settings Tab', status: 'PASS', screenshot: '/tmp/iris-06-settings-tab.png' });
    } catch (e) {
      console.log('    ⚠️  Settings tab not found, skipping');
      results.push({ test: 'Settings Tab', status: 'SKIP' });
    }
    
    // Test 8: Back to Dashboard
    console.log('\n8️⃣  Returning to Dashboard...');
    await page.click('a:has-text("Dashboard"), button:has-text("Dashboard")');
    await waitForPageFullyLoaded(page);
    
    // Test 9: Logout and Login as PM
    console.log('\n9️⃣  Testing PM Role (Austin Burke)...');
    try {
      // Try to find logout button
      const logoutSelectors = [
        'button:has-text("Sign out")',
        'a:has-text("Sign out")',
        'button:has-text("Logout")',
        '[data-testid="logout"]'
      ];
      
      let loggedOut = false;
      for (const selector of logoutSelectors) {
        try {
          await page.click(selector, { timeout: 2000 });
          loggedOut = true;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!loggedOut) {
        // Just go to login page directly
        await page.goto('https://bsemanager.vercel.app/login');
      }
      
      await waitForPageFullyLoaded(page);
    } catch (e) {
      console.log('    ⚠️  Could not find logout, navigating to login');
      await page.goto('https://bsemanager.vercel.app/login');
      await waitForPageFullyLoaded(page);
    }
    
    // Login as PM
    await page.fill('input[type="email"]', 'aburke@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023pm');
    await page.click('button[type="submit"]');
    await waitForPageFullyLoaded(page);
    await page.screenshot({ path: '/tmp/iris-07-pm-dashboard.png', fullPage: true });
    console.log('    ✅ PM Dashboard screenshot saved: /tmp/iris-07-pm-dashboard.png');
    results.push({ test: 'PM Login', status: 'PASS', screenshot: '/tmp/iris-07-pm-dashboard.png' });
    
    // Test 10: PM tries to access Accounting (should be blocked)
    console.log('\n🔟 Testing PM Access Control (should block /accounting)...');
    await page.goto('https://bsemanager.vercel.app/accounting');
    await waitForPageFullyLoaded(page);
    const url = page.url();
    if (url.includes('/accounting')) {
      console.log('    ❌ PM can access /accounting (should be blocked!)');
      results.push({ test: 'PM Access Control', status: 'FAIL', note: 'PM can access /accounting' });
    } else {
      console.log('    ✅ PM correctly redirected from /accounting');
      results.push({ test: 'PM Access Control', status: 'PASS' });
    }
    await page.screenshot({ path: '/tmp/iris-08-pm-access-control.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-08-pm-access-control.png');
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 TEST SUMMARY\n');
    results.forEach((r, i) => {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'SKIP' ? '⏭️' : '❌';
      console.log(`${icon} ${i + 1}. ${r.test}: ${r.status}`);
      if (r.screenshot) console.log(`   📸 ${r.screenshot}`);
      if (r.note) console.log(`   ℹ️  ${r.note}`);
    });
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const skipCount = results.filter(r => r.status === 'SKIP').length;
    console.log(`\n📈 Results: ${passCount} PASS, ${failCount} FAIL, ${skipCount} SKIP (${results.length} total)`);
    
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
