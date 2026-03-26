const { chromium } = require('@playwright/test');

async function testLogin() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1440, height: 900 });
  
  console.log('Opening localhost:3000...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  console.log('Logging in as Austin Ray...');
  await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
  
  // Get the password - since we don't have it, we'll need to ask Austin
  console.log('WAITING FOR PASSWORD INPUT...');
  
  await browser.close();
}

testLogin().catch(err => console.error('Error:', err.message));
