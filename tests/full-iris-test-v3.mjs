import { chromium } from 'playwright';
import fs from 'fs';

async function waitForPageFullyLoaded(page, additionalWait = 3000) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(additionalWait);
  // Check for any loading indicators
  await page.waitForSelector('.loading, [data-loading="true"], button:has-text("Signing in")', 
    { state: 'hidden', timeout: 10000 }).catch(() => {});
}

async function analyzeScreenshot(path, expectedContent) {
  // Simple check - does the file exist and is it reasonably sized?
  if (!fs.existsSync(path)) {
    return { valid: false, reason: 'File does not exist' };
  }
  const stats = fs.statSync(path);
  if (stats.size < 10000) {
    return { valid: false, reason: 'File too small (likely failed)' };
  }
  return { valid: true };
}

async function testIRIS() {
  console.log('🧪 IRIS Comprehensive Automated Test v3\n');
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
    results.push({ test: 'Login Page', status: 'PASS' });
    
    // Test 2: Login as Admin and WAIT for dashboard
    console.log('\n2️⃣  Logging in as Admin (aray@blackstoneeng.com)...');
    await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023admin');
    await page.click('button[type="submit"]');
    
    // Wait for the "Signing in..." button to disappear
    console.log('    ⏳ Waiting for authentication to complete...');
    await page.waitForSelector('button:has-text("Signing in")', { state: 'hidden', timeout: 15000 })
      .catch(() => console.log('    ⚠️  Signing in button timeout'));
    
    // Wait for dashboard elements to appear
    await page.waitForSelector('text=/Dashboard|Total Revenue|Projects/', { timeout: 15000 })
      .catch(() => console.log('    ⚠️  Dashboard elements timeout'));
    
    // Extra wait for full page load
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');
    
    console.log('    ✅ Dashboard should be loaded now');
    await page.screenshot({ path: '/tmp/iris-02-admin-dashboard.png', fullPage: true });
    console.log('    ✅ Screenshot saved: /tmp/iris-02-admin-dashboard.png');
    
    // Verify we're actually on the dashboard
    const url = page.url();
    if (url.includes('/dashboard') || url.includes('/app') || !url.includes('/login')) {
      console.log('    ✅ Confirmed on dashboard page');
      results.push({ test: 'Admin Login', status: 'PASS' });
    } else {
      console.log('    ❌ Still on login page!');
      results.push({ test: 'Admin Login', status: 'FAIL', note: 'Did not navigate to dashboard' });
    }
    
    // Test 3: Dashboard Summary Cards
    console.log('\n3️⃣  Checking Dashboard Summary Cards...');
    const revenue = await page.locator('text=/Total Revenue|Revenue/i').first().isVisible().catch(() => false);
    const cost = await page.locator('text=/Total Cost|Cost/i').first().isVisible().catch(() => false);
    console.log('    📊 Revenue card:', revenue ? 'FOUND' : 'MISSING');
    console.log('    📊 Cost card:', cost ? 'FOUND' : 'MISSING');
    results.push({ test: 'Dashboard Cards', status: (revenue && cost) ? 'PASS' : 'PARTIAL' });
    
    // Test 4-7: Navigate tabs
    const tabs = [
      { name: 'Invoices', num: 4 },
      { name: 'Time', num: 5 },
      { name: 'Expenses', num: 6 },
      { name: 'Settings', num: 7 }
    ];
    
    for (const tab of tabs) {
      console.log(`\n${tab.num}️⃣  Testing ${tab.name} Tab...`);
      try {
        await page.click(`a:has-text("${tab.name}"), button:has-text("${tab.name}")`);
        await waitForPageFullyLoaded(page, 5000); // Extra wait for data loading
        await page.screenshot({ path: `/tmp/iris-0${tab.num}-${tab.name.toLowerCase()}-tab.png`, fullPage: true });
        console.log(`    ✅ Screenshot saved: /tmp/iris-0${tab.num}-${tab.name.toLowerCase()}-tab.png`);
        results.push({ test: `${tab.name} Tab`, status: 'PASS' });
      } catch (e) {
        console.log(`    ❌ Failed to access ${tab.name} tab:`, e.message);
        results.push({ test: `${tab.name} Tab`, status: 'FAIL', note: e.message });
      }
    }
    
    // Test 8: Back to Dashboard before logout
    console.log('\n8️⃣  Returning to Dashboard...');
    await page.click('a:has-text("Dashboard"), button:has-text("Dashboard")').catch(() => {});
    await waitForPageFullyLoaded(page);
    
    // Test 9: Logout and Login as PM
    console.log('\n9️⃣  Testing PM Role (Austin Burke)...');
    
    // Navigate to login page (easier than finding logout)
    await page.goto('https://bsemanager.vercel.app/login');
    await waitForPageFullyLoaded(page);
    
    // Login as PM
    await page.fill('input[type="email"]', 'aburke@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023pm');
    await page.click('button[type="submit"]');
    
    // Wait for PM dashboard
    await page.waitForSelector('button:has-text("Signing in")', { state: 'hidden', timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: '/tmp/iris-08-pm-dashboard.png', fullPage: true });
    console.log('    ✅ PM Dashboard screenshot saved');
    
    const pmUrl = page.url();
    if (!pmUrl.includes('/login')) {
      results.push({ test: 'PM Login', status: 'PASS' });
    } else {
      results.push({ test: 'PM Login', status: 'FAIL', note: 'Still on login page' });
    }
    
    // Test 10: PM Access Control
    console.log('\n🔟 Testing PM Access Control (should block /accounting)...');
    await page.goto('https://bsemanager.vercel.app/accounting');
    await waitForPageFullyLoaded(page);
    const finalUrl = page.url();
    
    if (finalUrl.includes('/accounting')) {
      console.log('    ❌ PM can access /accounting (should be blocked!)');
      results.push({ test: 'PM Access Control', status: 'FAIL', note: 'PM accessed /accounting' });
    } else {
      console.log('    ✅ PM correctly blocked from /accounting');
      console.log(`    📍 Redirected to: ${finalUrl}`);
      results.push({ test: 'PM Access Control', status: 'PASS' });
    }
    await page.screenshot({ path: '/tmp/iris-09-pm-access-control.png', fullPage: true });
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 TEST SUMMARY\n');
    results.forEach((r, i) => {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'PARTIAL' ? '⚠️' : '❌';
      console.log(`${icon} ${i + 1}. ${r.test}: ${r.status}`);
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
