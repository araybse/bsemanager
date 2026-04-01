#!/usr/bin/env node
import { chromium } from 'playwright';

const TEST_URL = 'http://localhost:3001';
const EMAIL = 'aray@blackstoneeng.com';
const PASSWORD = 'BsE#2023admin';
const PROJECT_ID = '24-01'; // Glen Kernan

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navigating to login...');
    await page.goto(`${TEST_URL}/login`);
    await page.waitForLoadState('networkidle');

    console.log('2. Logging in...');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    console.log('3. Navigating to Projects...');
    await page.click('a[href="/projects"]');
    await page.waitForLoadState('networkidle');

    console.log('4. Finding project 24-01...');
    await page.click(`text=24-01`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('5. Capturing dashboard cards...');
    await page.screenshot({ path: '/tmp/iris-project-24-01-new.png', fullPage: false });

    // Extract card values
    const cards = await page.evaluate(() => {
      const cardData = {};
      document.querySelectorAll('[class*="Card"]').forEach((card) => {
        const desc = card.querySelector('[class*="CardDescription"]')?.textContent;
        const title = card.querySelector('[class*="CardTitle"]')?.textContent;
        if (desc && title) {
          cardData[desc] = title;
        }
      });
      return cardData;
    });

    console.log('\n📊 Dashboard Card Values:');
    console.log(JSON.stringify(cards, null, 2));

    console.log('\n✅ Test complete! Screenshot saved to /tmp/iris-project-24-01-new.png');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/iris-test-error.png' });
  } finally {
    await browser.close();
  }
})();
