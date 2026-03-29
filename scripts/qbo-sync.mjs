import { chromium } from 'playwright';

async function qboSync() {
  console.log('🔄 IRIS QB Sync\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
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
    
    await page.waitForURL(/dashboard|accounting/, { timeout: 20000 });
    await page.waitForTimeout(3000);
    console.log('✅ Logged in\n');
    
    // Go to Settings
    await page.goto('https://bsemanager.vercel.app/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ On Settings page\n');
    
    // Click QBO tab/button
    console.log('🔍 Clicking QBO tab...');
    await page.click('button:has-text("QBO")');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: '/tmp/qbo-tab.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/qbo-tab.png\n');
    
    // Look for sync buttons
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons after clicking QBO:`);
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.trim()) {
        console.log(`  - "${text.trim()}"`);
      }
    }
    
    // Find Sync All button
    const syncAllBtn = page.locator('button').filter({ hasText: /sync all/i }).first();
    
    if (await syncAllBtn.count() > 0) {
      console.log('\n✅ Found "Sync All" button! Clicking...\n');
      await syncAllBtn.click();
      
      console.log('⏳ Sync started. Waiting 120 seconds...\n');
      
      // Watch for completion
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(10000);
        console.log(`   ${(i+1)*10}s elapsed...`);
      }
      
      await page.screenshot({ path: '/tmp/qbo-after-sync.png', fullPage: true });
      console.log('\n✅ Sync should be complete!\n');
      console.log('📸 Screenshot: /tmp/qbo-after-sync.png\n');
      
      // Verify results
      console.log('📊 Checking results...\n');
      
      await page.goto('https://bsemanager.vercel.app/accounting');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
      
      const paidCount = await page.locator('text=/\\bPaid\\b/i').count();
      const unpaidCount = await page.locator('text=/\\bUnpaid\\b/i').count();
      
      console.log(`Invoices: ${paidCount} Paid, ${unpaidCount} Unpaid`);
      await page.screenshot({ path: '/tmp/invoices-final.png', fullPage: true });
      
      await page.goto('https://bsemanager.vercel.app/time-entries');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
      
      const billedCount = await page.locator('text=/\\bBilled\\b/i').count();
      const unbilledCount = await page.locator('text=/\\bUnbilled\\b/i').count();
      
      console.log(`Time Entries: ${billedCount} Billed, ${unbilledCount} Unbilled`);
      await page.screenshot({ path: '/tmp/time-final.png', fullPage: true });
      
      console.log('\n' + '='.repeat(80));
      console.log('✅ SYNC COMPLETE!\n');
      console.log('📊 Final Results:');
      console.log(`   Invoices: ${paidCount} paid, ${unpaidCount} unpaid`);
      console.log(`   Time: ${billedCount} billed, ${unbilledCount} unbilled\n`);
      
    } else {
      console.log('\n⚠️  Could not find Sync All button\n');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
  } finally {
    console.log('⏸️  Closing in 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

qboSync();
