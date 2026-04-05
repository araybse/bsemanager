import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
  await page.fill('input[type="password"]', 'BsE#2023admin');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Go to Time -> Entries
  await page.goto('http://localhost:3000/time');
  await page.waitForLoadState('networkidle');
  await page.click('text=Entries');
  await page.waitForTimeout(2000);

  console.log('\nBEFORE FILTER:');
  let summary = await page.locator('text=/Showing \\d+ of \\d+ entries/').textContent();
  console.log(summary);

  // Fill in date range: 01/01/2024 to 12/31/2024
  console.log('\nFilling date filter: 01/01/2024 to 12/31/2024...');
  await page.fill('input#start-date', '2024-01-01');
  await page.fill('input#end-date', '2024-12-31');
  await page.waitForTimeout(2000);

  console.log('\nAFTER FILTER:');
  summary = await page.locator('text=/Showing \\d+ of \\d+ entries/').textContent();
  console.log(summary);

  const total = await page.locator('text=/Total: [\\d.]+ hours/').textContent();
  console.log(total);

  await page.screenshot({ path: './filtered-2024.png', fullPage: true });
  console.log('\nScreenshot: filtered-2024.png');

  await page.waitForTimeout(5000);
  await browser.close();
})();
