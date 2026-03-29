import { chromium } from 'playwright';

async function checkSyncStatus() {
  console.log('🔍 Checking Sync Status\n');
  
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
    
    // Go to Settings > QBO
    await page.goto('https://bsemanager.vercel.app/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("QBO")');
    await page.waitForTimeout(2000);
    console.log('✅ On QBO tab\n');
    
    // Take initial screenshot
    await page.screenshot({ path: '/tmp/sync-status-check.png', fullPage: true });
    
    // Check if Sync All button is disabled (means sync is running)
    const syncAllBtn = page.locator('button').filter({ hasText: /sync all/i }).first();
    const isDisabled = await syncAllBtn.evaluate(btn => btn.disabled);
    const buttonText = await syncAllBtn.textContent();
    
    console.log(`Sync All button: "${buttonText}"`);
    console.log(`Button disabled: ${isDisabled}`);
    
    if (isDisabled) {
      console.log('\n⏳ SYNC IS STILL RUNNING!\n');
      console.log('Monitoring sync progress...\n');
      
      // Monitor every 30 seconds until button is enabled again
      let elapsed = 0;
      while (isDisabled && elapsed < 600) { // Max 10 minutes
        await page.waitForTimeout(30000);
        elapsed += 30;
        
        const stillDisabled = await syncAllBtn.evaluate(btn => btn.disabled);
        const currentText = await syncAllBtn.textContent();
        
        console.log(`[${elapsed}s] Button: "${currentText}" | Disabled: ${stillDisabled}`);
        
        if (!stillDisabled) {
          console.log('\n✅ SYNC COMPLETED!\n');
          break;
        }
        
        await page.screenshot({ path: `/tmp/sync-${elapsed}s.png`, fullPage: true });
      }
      
      if (elapsed >= 600) {
        console.log('\n⚠️  Sync exceeded 10 minutes, stopping monitoring\n');
      }
      
    } else {
      console.log('\n✅ Sync is NOT running (button enabled)\n');
    }
    
    // Final screenshot
    await page.screenshot({ path: '/tmp/sync-final-status.png', fullPage: true });
    
    console.log('\n📸 Screenshots saved to /tmp/sync-*.png\n');
    console.log('Keeping browser open for 60 seconds for manual inspection...\n');
    
    await page.waitForTimeout(60000);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

checkSyncStatus();
