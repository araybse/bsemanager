const { chromium } = require('@playwright/test');

async function loginAsAustin() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1440, height: 900 });
  
  console.log('Opening localhost...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  
  console.log('Filling email...');
  await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
  
  console.log('Filling password...');
  await page.fill('input[type="password"]', 'BsE#2023admin');
  
  console.log('Clicking submit...');
  await page.click('button[type="submit"]');
  
  console.log('Waiting for navigation...');
  await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  const url = page.url();
  console.log('Logged in. Current URL:', url);
  console.log('\n✅ You are logged in as Austin Ray');
  console.log('The browser is now open - take over and explore!\n');
  
  // Keep the browser open indefinitely
  console.log('Browser will stay open. Close it manually when done.');
}

loginAsAustin().catch(err => {
  console.error('Login error:', err.message);
  process.exit(1);
});
