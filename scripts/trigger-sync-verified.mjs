import { chromium } from 'playwright';

async function triggerSyncVerified() {
  console.log('🔄 Triggering Sync (Verified)\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Log network requests
  page.on('request', req => {
    if (req.url().includes('sync')) {
      console.log('  [Network] Request:', req.method(), req.url());
    }
  });
  
  page.on('response', resp => {
    if (resp.url().includes('sync')) {
      console.log('  [Network] Response:', resp.status(), resp.url());
    }
  });
  
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
    
    // Find Sync All button
    const syncAllBtn = page.locator('button').filter({ hasText: /sync all/i }).first();
    const textBefore = await syncAllBtn.textContent();
    const disabledBefore = await syncAllBtn.evaluate(btn => btn.disabled);
    
    console.log('Before click:');
    console.log(`  Text: "${textBefore}"`);
    console.log(`  Disabled: ${disabledBefore}\n`);
    
    await page.screenshot({ path: '/tmp/before-click.png', fullPage: true });
    
    // Click and watch for changes
    console.log('🖱️  Clicking Sync All button...\n');
    await syncAllBtn.click();
    
    // Wait a moment for UI to update
    await page.waitForTimeout(3000);
    
    const textAfter = await syncAllBtn.textContent();
    const disabledAfter = await syncAllBtn.evaluate(btn => btn.disabled);
    
    console.log('After click:');
    console.log(`  Text: "${textAfter}"`);
    console.log(`  Disabled: ${disabledAfter}\n`);
    
    await page.screenshot({ path: '/tmp/after-click.png', fullPage: true });
    
    if (disabledAfter) {
      console.log('✅ SYNC STARTED! Button is now disabled.\n');
      console.log('Monitoring progress (checking every 30s)...\n');
      
      let elapsed = 0;
      while (elapsed < 600) { // Max 10 minutes
        await page.waitForTimeout(30000);
        elapsed += 30;
        
        const currentDisabled = await syncAllBtn.evaluate(btn => btn.disabled);
        const currentText = await syncAllBtn.textContent();
        
        console.log(`[${elapsed}s] "${currentText}" | Disabled: ${currentDisabled}`);
        
        if (!currentDisabled) {
          console.log('\n✅ SYNC COMPLETE!\n');
          await page.screenshot({ path: '/tmp/sync-complete.png', fullPage: true });
          break;
        }
      }
      
    } else {
      console.log('⚠️  Button did not disable - sync may not have started\n');
      console.log('Check screenshots /tmp/before-click.png and /tmp/after-click.png\n');
    }
    
    console.log('Keeping browser open for inspection (60s)...\n');
    await page.waitForTimeout(60000);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

triggerSyncVerified();
