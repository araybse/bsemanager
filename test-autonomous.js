const { chromium } = require('@playwright/test');

async function test() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Autonomous test starting...');
  console.log('✓ Opened browser independently');
  
  await page.goto('https://bsemanager.vercel.app/login');
  console.log('✓ Navigated to login page independently');
  
  await page.fill('input[type="email"]', 'aburke@blackstoneeng.com');
  console.log('✓ Typed email independently');
  
  await page.fill('input[type="password"]', 'BsE#2023AB');
  console.log('✓ Typed password independently');
  
  await page.click('button[type="submit"]');
  console.log('✓ Clicked submit independently');
  
  await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  const url = page.url();
  console.log(`✓ Navigated to: ${url}`);
  
  if (!url.includes('/login')) {
    console.log('✓ Successfully logged in without user intervention');
  }
  
  await browser.close();
}

test().catch(err => console.error('Error:', err.message));
