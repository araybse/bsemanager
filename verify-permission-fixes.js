const { chromium } = require('@playwright/test');

const testUsers = [
  { email: 'aburke@blackstoneeng.com', password: 'BsE#2023AB', role: 'project_manager', name: 'Austin Burke' },
  { email: 'ameta@blackstoneeng.com', password: 'BsE#2023AM', role: 'employee', name: 'Arber Meta' },
  { email: 'mwilson@blackstoneeng.com', password: 'BsE#2023MW', role: 'employee', name: 'Morgan Wilson' },
];

async function testUser(user) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${user.name} (${user.role})`);
    console.log(`${'='.repeat(60)}`);
    
    // Login
    await page.goto('https://bsemanager.vercel.app/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    const url = page.url();
    console.log(`\nAfter login: ${url}`);

    // Test 1: Try accessing /dashboard
    console.log(`\nTest 1: Access /dashboard`);
    await page.goto('https://bsemanager.vercel.app/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const dashboardUrl = page.url();
    if (user.role === 'employee') {
      if (!dashboardUrl.includes('/dashboard')) {
        console.log(`  ✓ PASS - Redirected from dashboard (now at: ${dashboardUrl})`);
      } else {
        console.log(`  ✗ FAIL - Still on dashboard page`);
      }
    } else {
      if (dashboardUrl.includes('/dashboard')) {
        console.log(`  ✓ PASS - ${user.role} can access dashboard`);
      } else {
        console.log(`  ✗ FAIL - ${user.role} was redirected from dashboard`);
      }
    }

    // Test 2: Try accessing /invoices  
    console.log(`\nTest 2: Access /invoices`);
    await page.goto('https://bsemanager.vercel.app/invoices', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const invoicesUrl = page.url();
    if (user.role === 'employee') {
      if (!invoicesUrl.includes('/invoices')) {
        console.log(`  ✓ PASS - Redirected from invoices (now at: ${invoicesUrl})`);
      } else {
        console.log(`  ✗ FAIL - Still on invoices page`);
      }
    } else {
      if (invoicesUrl.includes('/invoices')) {
        console.log(`  ✓ PASS - ${user.role} can access invoices`);
      } else {
        console.log(`  ✗ FAIL - ${user.role} was redirected from invoices`);
      }
    }

    // Test 3: Try accessing /accounting (admin only)
    console.log(`\nTest 3: Access /accounting`);
    await page.goto('https://bsemanager.vercel.app/accounting', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const accountingUrl = page.url();
    if (user.role !== 'admin') {
      if (!accountingUrl.includes('/accounting')) {
        console.log(`  ✓ PASS - ${user.role} redirected from accounting (now at: ${accountingUrl})`);
      } else {
        console.log(`  ✗ FAIL - ${user.role} can still access accounting`);
      }
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function runTests() {
  console.log('\n\n🔍 Permission Fix Verification Tests\n');
  
  for (const user of testUsers) {
    await testUser(user);
  }
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('✅ Permission verification complete');
  console.log(`${'='.repeat(60)}\n`);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
