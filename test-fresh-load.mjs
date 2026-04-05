import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ 
    // Clear all caches and storage
    storageState: undefined 
  });
  const page = await context.newPage();

  // Clear all caches
  await context.clearCookies();

  // Login fresh
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
  await page.fill('input[type="password"]', 'BsE#2023admin');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Go to Time -> Entries (fresh page load, no cache)
  await page.goto('http://localhost:3000/time');
  await page.waitForLoadState('networkidle');
  await page.click('text=Entries');
  await page.waitForTimeout(3000);

  console.log('\nBEFORE FILTER (fresh load):');
  let summary = await page.locator('text=/Showing \\d+ of \\d+ entries/').textContent();
  console.log(summary);

  // Apply filter
  await page.fill('input#start-date', '2024-01-01');
  await page.fill('input#end-date', '2024-12-31');
  await page.waitForTimeout(3000);

  console.log('\nAFTER FILTER:');
  summary = await page.locator('text=/Showing \\d+ of \\d+ entries/').textContent();
  console.log(summary);

  const total = await page.locator('text=/Total: [\\d.]+ hours/').textContent();
  console.log(total);

  await page.screenshot({ path: './test-fresh-load.png', fullPage: true });
  
  await page.waitForTimeout(3000);
  await browser.close();
})();
