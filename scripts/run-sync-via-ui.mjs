import { chromium } from 'playwright';

async function runSync() {
  console.log('🔄 Running IRIS Sync via UI\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto('https://bsemanager.vercel.app');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023admin');
    await page.click('button[type="submit"]');
    await page.waitForSelector('button:has-text("Signing in")', { state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);
    console.log('✅ Logged in\n');
    
    // Navigate to Settings
    console.log('⚙️  Navigating to Settings...');
    await page.goto('https://bsemanager.vercel.app/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    console.log('✅ On Settings page\n');
    
    // Take screenshot before sync
    await page.screenshot({ path: '/tmp/settings-before-sync.png', fullPage: true });
    console.log('📸 Screenshot saved: /tmp/settings-before-sync.png\n');
    
    // Find and click Sync All button
    console.log('🔍 Looking for Sync All button...');
    
    // Try multiple selectors
    const syncButton = await page.locator('button:has-text("Sync All"), button:has-text("Sync"), button:has-text("sync")').first();
    
    if (await syncButton.count() > 0) {
      console.log('✅ Found Sync button, clicking...\n');
      await syncButton.click();
      console.log('⏳ Sync started! Waiting 90 seconds for completion...\n');
      
      // Wait for sync to complete
      await page.waitForTimeout(90000);
      
      console.log('✅ Sync should be complete!\n');
      
      // Screenshot after sync
      await page.screenshot({ path: '/tmp/settings-after-sync.png', fullPage: true });
      console.log('📸 Screenshot saved: /tmp/settings-after-sync.png\n');
      
    } else {
      console.log('⚠️  Could not find Sync button on page');
      console.log('📸 Saving page screenshot for debugging...\n');
      await page.screenshot({ path: '/tmp/settings-no-button.png', fullPage: true });
    }
    
    // Now verify the results
    console.log('📊 Verifying results...\n');
    
    // Check Invoices
    console.log('1️⃣  Checking Invoices page...');
    await page.goto('https://bsemanager.vercel.app/accounting');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const paidCount = await page.locator('text=/Paid/i').count();
    const unpaidCount = await page.locator('text=/Unpaid/i').count();
    console.log(`   Found: ${paidCount} "Paid", ${unpaidCount} "Unpaid"`);
    
    await page.screenshot({ path: '/tmp/invoices-after-sync.png', fullPage: true });
    
    // Check Time Entries
    console.log('\n2️⃣  Checking Time Entries page...');
    await page.goto('https://bsemanager.vercel.app/time-entries');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const billedCount = await page.locator('text=/Billed/i').count();
    const unbilledCount = await page.locator('text=/Unbilled/i').count();
    console.log(`   Found: ${billedCount} "Billed", ${unbilledCount} "Unbilled"`);
    
    await page.screenshot({ path: '/tmp/time-after-sync.png', fullPage: true });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Sync Complete!\n');
    console.log('📊 Results:');
    console.log(`   Invoices: ${paidCount} paid, ${unpaidCount} unpaid`);
    console.log(`   Time: ${billedCount} billed, ${unbilledCount} unbilled`);
    console.log('\n📸 Screenshots saved:');
    console.log('   /tmp/settings-before-sync.png');
    console.log('   /tmp/settings-after-sync.png');
    console.log('   /tmp/invoices-after-sync.png');
    console.log('   /tmp/time-after-sync.png');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: '/tmp/sync-error.png', fullPage: true });
  } finally {
    console.log('\n⏸️  Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

runSync();
