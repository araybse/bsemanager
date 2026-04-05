import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console messages
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]:`, msg.text());
  });

  // Go to the time page
  console.log('Navigating to http://localhost:3000/time');
  await page.goto('http://localhost:3000/time');
  await page.waitForLoadState('networkidle');

  // Click the Entries tab
  console.log('Clicking Entries tab...');
  await page.click('text=Entries');
  await page.waitForTimeout(3000);

  // Check what's showing
  const noEntriesMsg = await page.locator('text=No time entries found').count();
  const tableRows = await page.locator('table tbody tr').count();

  console.log('\n=== RESULTS ===');
  console.log(`"No entries" message: ${noEntriesMsg > 0 ? 'YES' : 'NO'}`);
  console.log(`Table rows: ${tableRows}`);

  // Take screenshot
  await page.screenshot({ path: './entries-tab-debug.png', fullPage: true });
  console.log('Screenshot: entries-tab-debug.png');

  console.log('\nBrowser left open. Press Ctrl+C when done.');
})();
