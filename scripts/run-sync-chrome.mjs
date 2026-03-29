import { chromium } from 'playwright';

async function runSync() {
  console.log('🔄 Running IRIS Sync with Chrome\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome'
  });
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
    console.log('⚙️  Navigating to Settings > QBO...');
    await page.goto('https://bsemanager.vercel.app/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("QBO")');
    await page.waitForTimeout(2000);
    console.log('✅ On QBO tab\n');
    
    // Screenshot before
    await page.screenshot({ path: '/tmp/before-sync.png', fullPage: true });
    
    // Click Sync All
    console.log('🖱️  Clicking Sync All...');
    await page.click('button:has-text("Sync All")');
    console.log('⏳ Sync started, waiting 2 minutes...\n');
    
    // Wait and monitor
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(10000);
      console.log(`   ${(i+1)*10}s elapsed...`);
    }
    
    console.log('\n✅ Sync should be complete!\n');
    
    // Screenshot after
    await page.screenshot({ path: '/tmp/after-sync.png', fullPage: true });
    
    // Check for errors
    const pageText = await page.textContent('body');
    
    if (pageText.includes('0 domains succeeded, 6 failed')) {
      console.log('❌ SYNC FAILED - Same error\n');
      
      // Look for error details
      const errorText = await page.locator('text=/error|fail/i').allTextContents();
      console.log('Error messages found:');
      errorText.forEach(err => console.log('  -', err));
      
    } else if (pageText.includes('succeeded')) {
      console.log('✅ SYNC SUCCEEDED!\n');
    }
    
    console.log('Keeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

runSync();
