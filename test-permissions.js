const { chromium } = require('@playwright/test');

const testUsers = [
  { email: 'aburke@blackstoneeng.com', password: 'BsE#2023AB', role: 'project_manager', name: 'Austin Burke' },
  { email: 'wkoning@blackstoneeng.com', password: 'BsE#2023WK', role: 'project_manager', name: 'Wesley Koning' },
  { email: 'ameta@blackstoneeng.com', password: 'BsE#2023AM', role: 'employee', name: 'Arber Meta' },
  { email: 'mwilson@blackstoneeng.com', password: 'BsE#2023MW', role: 'employee', name: 'Morgan Wilson' },
];

async function testUser(user) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`${user.name} (${user.role})`);
    console.log(`${'='.repeat(50)}`);
    
    // Go to login
    await page.goto('https://bsemanager.vercel.app/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Login
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // Wait for page
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    const url = page.url();
    console.log(`URL: ${url}`);
    
    // Get sidebar navigation
    const navItems = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('nav a, [class*="sidebar"] a').forEach(link => {
        const text = link.textContent.trim();
        if (text && text.length > 0 && !text.includes('Sign')) {
          items.push(text);
        }
      });
      return [...new Set(items)];
    });
    
    console.log(`\nNavigation visible:`);
    navItems.forEach(item => console.log(`  ✓ ${item}`));
    if (navItems.length === 0) {
      console.log(`  (None - still loading or page issue)`);
    }
    
    // Try going to a restricted page and see what happens
    if (user.role === 'employee') {
      await page.goto('https://bsemanager.vercel.app/invoices', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const invoicesUrl = page.url();
      if (invoicesUrl.includes('invoices')) {
        console.log(`\n⚠️  ISSUE: Employee can access /invoices (should not be able to)`);
      } else {
        console.log(`\n✓ Employee correctly redirected away from /invoices`);
      }
    }
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function run() {
  console.log('\n🔍 BSE Manager Permissions Test Suite\n');
  for (const user of testUsers) {
    await testUser(user);
  }
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ All tests completed`);
  console.log(`${'='.repeat(50)}\n`);
}

run();
