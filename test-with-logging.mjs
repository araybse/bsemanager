import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  // Capture all console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('FILTER') || text.includes('date') || text.includes('entries')) {
      console.log('[CONSOLE]:', text);
    }
  });

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

  console.log('\n=== FILLING DATE FILTER ===');
  await page.fill('input#start-date', '2024-01-01');
  await page.waitForTimeout(500);
  await page.fill('input#end-date', '2024-12-31');
  await page.waitForTimeout(3000);

  const summary = await page.locator('text=/Showing \\d+ of \\d+ entries/').textContent();
  console.log('\n=== RESULT ===');
  console.log(summary);

  // Print all filter-related logs
  console.log('\n=== ALL FILTER LOGS ===');
  logs.filter(l => l.includes('FILTER') || l.includes('📊') || l.includes('🔥')).forEach(l => console.log(l));

  await page.screenshot({ path: './test-with-logging.png', fullPage: true });
  await page.waitForTimeout(3000);
  await browser.close();
})();
