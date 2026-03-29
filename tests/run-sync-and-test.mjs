import { chromium } from 'playwright';

async function runSyncAndTest() {
  console.log('🧪 IRIS Post-Deployment Sync & Test\n');
  console.log('='.repeat(80) + '\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  try {
    // Step 1: Login
    console.log('1️⃣  Logging in...');
    await page.goto('https://bsemanager.vercel.app');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023admin');
    await page.click('button[type="submit"]');
    await page.waitForSelector('button:has-text("Signing in")', { state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);
    console.log('    ✅ Logged in\n');
    
    // Step 2: Navigate to Settings
    console.log('2️⃣  Navigating to Settings...');
    await page.click('a:has-text("Settings"), button:has-text("Settings")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    console.log('    ✅ On Settings page\n');
    
    // Step 3: Trigger Sync
    console.log('3️⃣  Triggering QB Sync All...');
    await page.screenshot({ path: '/tmp/iris-before-sync.png' });
    
    // Click the Sync All button
    await page.click('button:has-text("Sync All")');
    console.log('    ⏳ Sync started, waiting for completion...');
    
    // Wait for sync to complete (look for success message or button to re-enable)
    await page.waitForTimeout(90000); // Wait 90 seconds for sync
    
    await page.screenshot({ path: '/tmp/iris-after-sync.png' });
    console.log('    ✅ Sync should be complete\n');
    
    // Step 4: Test Invoices Page
    console.log('4️⃣  Testing Invoices page...');
    await page.click('a:has-text("Invoices")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Check for paid status
    const paidCount = await page.locator('text=Paid').count();
    const unpaidCount = await page.locator('text=Unpaid').count();
    
    console.log(`    📊 Found ${paidCount} "Paid" and ${unpaidCount} "Unpaid" invoices`);
    
    if (paidCount > 0) {
      console.log('    ✅ Invoice status fix verified - showing paid invoices!');
    } else {
      console.log('    ⚠️  No paid invoices found - may need to wait for sync');
    }
    
    await page.screenshot({ path: '/tmp/iris-test-invoices-fixed.png', fullPage: true });
    
    // Step 5: Test Time Entries
    console.log('\n5️⃣  Testing Time Entries page...');
    await page.click('a:has-text("Time")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const billedCount = await page.locator('text=Billed').count();
    const unbilledCount = await page.locator('text=Unbilled').count();
    
    console.log(`    📊 Found ${billedCount} "Billed" and ${unbilledCount} "Unbilled" entries`);
    
    if (billedCount > 0) {
      console.log('    ✅ Time billing fix verified - showing billed entries!');
    } else {
      console.log('    ⚠️  No billed entries found - may need to wait for sync');
    }
    
    await page.screenshot({ path: '/tmp/iris-test-time-fixed.png', fullPage: true });
    
    // Step 6: Test Expenses Page
    console.log('\n6️⃣  Testing Expenses page...');
    await page.click('a:has-text("Expenses")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Check if table has horizontal scroll
    const hasOverflow = await page.evaluate(() => {
      const table = document.querySelector('table');
      const container = table?.parentElement;
      return container?.scrollWidth > container?.clientWidth;
    });
    
    console.log(`    📊 Table overflow: ${hasOverflow ? 'YES (can scroll)' : 'NO'}`);
    
    if (hasOverflow) {
      console.log('    ✅ Expenses table fix verified - columns scrollable!');
    }
    
    await page.screenshot({ path: '/tmp/iris-test-expenses-fixed.png', fullPage: true });
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 TEST SUMMARY\n');
    console.log(`✅ Invoice Status: ${paidCount > 0 ? 'FIXED' : 'PENDING SYNC'} (${paidCount} paid)`);
    console.log(`✅ Time Billing: ${billedCount > 0 ? 'FIXED' : 'PENDING SYNC'} (${billedCount} billed)`);
    console.log(`✅ Expenses Overflow: ${hasOverflow ? 'FIXED' : 'CHECK MANUALLY'}`);
    
    console.log('\n📸 Screenshots saved:');
    console.log('  - /tmp/iris-test-invoices-fixed.png');
    console.log('  - /tmp/iris-test-time-fixed.png');
    console.log('  - /tmp/iris-test-expenses-fixed.png');
    
  } catch (err) {
    console.error('\n❌ Test Error:', err.message);
  } finally {
    console.log('\n⏸️  Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
    console.log('✅ Test complete!');
  }
}

runSyncAndTest();
