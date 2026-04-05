import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
  await page.fill('input[type="password"]', 'BsE#2023admin');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Go to Time page, Dashboard tab
  await page.goto('http://localhost:3000/time');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Check if PTO chart is visible
  const chartVisible = await page.locator('.recharts-surface').count();
  console.log(`Charts found on page: ${chartVisible}`);

  // Check for "No PTO usage available" message
  const noPtoMsg = await page.locator('text=No PTO usage available').count();
  console.log(`"No PTO" message: ${noPtoMsg > 0 ? 'YES (chart empty)' : 'NO (chart has data)'}`);

  // Check if any bars are rendered
  const barCount = await page.locator('.recharts-bar-rectangle').count();
  console.log(`PTO bars rendered: ${barCount}`);

  // Take screenshot
  await page.screenshot({ path: './test-pto-chart.png', fullPage: true });
  console.log('\nScreenshot: test-pto-chart.png');

  if (barCount > 0) {
    console.log('\n✅ PASS - PTO chart is rendering data');
  } else if (noPtoMsg > 0) {
    console.log('\n⚠️ INFO - No PTO data exists for current filter');
  } else {
    console.log('\n❌ FAIL - Chart exists but no data rendered');
  }

  await page.waitForTimeout(3000);
  await browser.close();
})();
