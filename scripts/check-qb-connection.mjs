import { chromium } from 'playwright';

async function checkQBConnection() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  try {
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
    console.log('📊 Checking QB connection status...');
    await page.goto('https://bsemanager.vercel.app/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("QBO")');
    await page.waitForTimeout(2000);
    
    // Look for connection status
    const pageText = await page.textContent('body');
    
    if (pageText.includes('Connected to QuickBooks')) {
      console.log('✅ QuickBooks: Connected');
    } else if (pageText.includes('Disconnect')) {
      console.log('✅ QuickBooks: Connected (Disconnect button visible)');
    } else if (pageText.includes('Connect') || pageText.includes('Authorize')) {
      console.log('❌ QuickBooks: NOT connected - needs authorization');
    } else {
      console.log('⚠️  QuickBooks: Status unclear');
    }
    
    // Screenshot
    await page.screenshot({ path: '/tmp/qb-connection-status.png', fullPage: true });
    console.log('\n📸 Screenshot saved: /tmp/qb-connection-status.png');
    
    // Check for error messages
    const errors = await page.locator('text=/error|failed|unauthorized/i').count();
    if (errors > 0) {
      console.log(`\n⚠️  Found ${errors} error message(s) on page`);
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

checkQBConnection();
