import { chromium } from 'playwright';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    console.log(`[CONSOLE ${msg.type()}]:`, text);
  });

  try {
    // Login first
    console.log('\n1. Going to login page...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    console.log('2. Filling in credentials...');
    await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023admin');
    
    console.log('3. Clicking sign in...');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Navigate to time page
    console.log('\n4. Navigating to /time...');
    await page.goto('http://localhost:3000/time');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click Entries tab
    console.log('5. Clicking Entries tab...');
    await page.click('text=Entries');
    await page.waitForTimeout(3000);

    // Check what's visible
    console.log('\n6. Checking page state...');
    const noEntriesVisible = await page.locator('text=No time entries found').isVisible().catch(() => false);
    const tableRowCount = await page.locator('table tbody tr').count();
    const filterSummary = await page.locator('text=/Showing \\d+ of \\d+ entries/').textContent().catch(() => 'Not found');

    console.log('\n=== RESULTS ===');
    console.log(`No entries message visible: ${noEntriesVisible}`);
    console.log(`Table rows found: ${tableRowCount}`);
    console.log(`Filter summary: ${filterSummary}`);

    // Take screenshot
    await page.screenshot({ path: './entries-debug-logged-in.png', fullPage: true });
    console.log('\nScreenshot saved: entries-debug-logged-in.png');

    // Print relevant console logs
    console.log('\n=== RELEVANT CONSOLE LOGS ===');
    const filterLogs = consoleMessages.filter(msg => 
      msg.includes('Filtering') || 
      msg.includes('entries') || 
      msg.includes('date') ||
      msg.includes('error')
    );
    filterLogs.forEach(log => console.log(log));

    console.log('\nDone! Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: './error-screenshot.png' });
  } finally {
    await browser.close();
  }
})();
