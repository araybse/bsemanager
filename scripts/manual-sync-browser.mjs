import { chromium } from 'playwright';

async function manualSync() {
  console.log('🔄 Manual Sync via Browser\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down to see what's happening
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Log all console messages
  page.on('console', msg => console.log('  [Browser]', msg.text()));
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto('https://bsemanager.vercel.app');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023admin');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/dashboard|accounting|projects/, { timeout: 20000 });
    await page.waitForTimeout(3000);
    console.log('✅ Logged in, current URL:', page.url(), '\n');
    
    // Navigate to Settings
    console.log('⚙️  Navigating to Settings...');
    
    // Try clicking sidebar link
    const settingsLink = page.locator('a[href*="settings"], a:has-text("Settings")').first();
    if (await settingsLink.count() > 0) {
      await settingsLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log('✅ On Settings page:', page.url(), '\n');
    } else {
      // Direct navigation
      await page.goto('https://bsemanager.vercel.app/settings');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/settings-page.png', fullPage: true });
    
    // Look for ANY button with sync-related text
    console.log('🔍 Looking for sync button...');
    const buttons = await page.locator('button').all();
    
    console.log(`   Found ${buttons.length} buttons on page:`);
    for (const btn of buttons) {
      const text = await btn.textContent();
      console.log(`     - "${text}"`);
    }
    
    // Try to find and click sync button
    const syncBtn = page.locator('button').filter({ hasText: /sync/i }).first();
    
    if (await syncBtn.count() > 0) {
      console.log('\n✅ Found sync button! Clicking...\n');
      await syncBtn.click();
      
      console.log('⏳ Waiting 120 seconds for sync to complete...\n');
      await page.waitForTimeout(120000);
      
      await page.screenshot({ path: '/tmp/settings-after-sync.png', fullPage: true });
      console.log('✅ Sync complete!\n');
    } else {
      console.log('\n⚠️  No sync button found. Available buttons listed above.\n');
    }
    
    console.log('Press Ctrl+C to close browser...');
    await page.waitForTimeout(60000); // Keep open for manual inspection
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

manualSync();
