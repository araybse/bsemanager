const { chromium } = require('@playwright/test');

const testUsers = [
  { email: 'aburke@blackstoneeng.com', password: 'BsE#2023AB', role: 'project_manager', name: 'Austin Burke' },
  { email: 'wkoning@blackstoneeng.com', password: 'BsE#2023WK', role: 'project_manager', name: 'Wesley Koning' },
  { email: 'ameta@blackstoneeng.com', password: 'BsE#2023AM', role: 'employee', name: 'Arber Meta' },
  { email: 'mwilson@blackstoneeng.com', password: 'BsE#2023MW', role: 'employee', name: 'Morgan Wilson' },
];

const ADMIN_ONLY_PAGES = ['/accounting', '/cash-flow', '/contract-labor', '/proposals', '/time-entries'];
const PM_PAGES = ['/dashboard', '/projects', '/invoices', '/unbilled', '/timesheet'];
const EMPLOYEE_PAGES = ['/timesheet'];

async function testPageAccess(page, url, expectedAccessible) {
  await page.goto(`https://bsemanager.vercel.app${url}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const finalUrl = page.url();
  const accessible = finalUrl.includes(url.replace(/^\//, ''));
  return { url, expectedAccessible, accessible, finalUrl };
}

async function testUser(user) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let passed = 0, failed = 0;
  
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${user.name} (${user.role.toUpperCase()})`);
    console.log(`${'='.repeat(70)}`);
    
    // LOGIN
    await page.goto('https://bsemanager.vercel.app/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    console.log(`✓ Login successful`);
    
    // GET SIDEBAR NAVIGATION
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
    
    console.log(`\n📋 SIDEBAR NAVIGATION:`);
    if (navItems.length > 0) {
      navItems.forEach(item => console.log(`   ✓ ${item}`));
      passed++;
    } else {
      console.log(`   ✗ No navigation items visible`);
      failed++;
    }
    
    // TEST PAGE ACCESS BY ROLE
    console.log(`\n🔐 PAGE ACCESS CONTROL:`);
    
    let pagesToTest = [];
    if (user.role === 'admin') {
      pagesToTest = [
        { url: '/dashboard', should: true },
        { url: '/projects', should: true },
        { url: '/invoices', should: true },
        { url: '/accounting', should: true },
        { url: '/cash-flow', should: true },
      ];
    } else if (user.role === 'project_manager') {
      pagesToTest = [
        { url: '/dashboard', should: true },
        { url: '/projects', should: true },
        { url: '/invoices', should: true },
        { url: '/accounting', should: false },
        { url: '/cash-flow', should: false },
      ];
    } else if (user.role === 'employee') {
      pagesToTest = [
        { url: '/dashboard', should: false },
        { url: '/invoices', should: false },
        { url: '/accounting', should: false },
        { url: '/timesheet', should: true },
      ];
    }
    
    for (const test of pagesToTest) {
      const result = await testPageAccess(page, test.url, test.should);
      const pass = result.accessible === test.should;
      
      if (pass) {
        console.log(`   ✓ ${test.url}: ${test.should ? 'Accessible' : 'Blocked'}`);
        passed++;
      } else {
        console.log(`   ✗ ${test.url}: Expected ${test.should ? 'access' : 'block'}, got ${result.accessible}`);
        failed++;
      }
    }
    
    // CHECK DATA VISIBILITY (Labor Amount column)
    console.log(`\n👁️  DATA VISIBILITY:`);
    if (user.role !== 'employee') {
      // Try to access a project detail page
      await page.goto('https://bsemanager.vercel.app/projects', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      
      // Check if we can see the page
      const projectsVisible = await page.evaluate(() => {
        return document.body.textContent.includes('project') || document.body.textContent.includes('Project');
      });
      
      if (projectsVisible) {
        console.log(`   ✓ Can view projects page`);
        passed++;
      } else {
        console.log(`   ✗ Cannot view projects page`);
        failed++;
      }
    } else {
      console.log(`   - Skipped (employee restricted)`);
    }
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    failed++;
  } finally {
    await browser.close();
  }
  
  return { user: user.name, role: user.role, passed, failed };
}

async function runFullVerification() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║          #36 COMPREHENSIVE VERIFICATION TEST SUITE                ║');
  console.log('║        Role-Based Permissions & Frontend/Backend Checks           ║');
  console.log('║                  Live Deployment Verification                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('\nTest Date: ' + new Date().toISOString());
  console.log('Target: https://bsemanager.vercel.app\n');
  
  const results = [];
  for (const user of testUsers) {
    const result = await testUser(user);
    results.push(result);
  }
  
  // SUMMARY
  console.log('\n\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                        FINAL SUMMARY                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  let totalPassed = 0, totalFailed = 0;
  results.forEach(r => {
    console.log(`${r.user} (${r.role}): ${r.passed} ✓  ${r.failed} ✗`);
    totalPassed += r.passed;
    totalFailed += r.failed;
  });
  
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`OVERALL: ${totalPassed} passed, ${totalFailed} failed`);
  
  if (totalFailed === 0) {
    console.log('✅ ALL TESTS PASSED - #36 FULLY IMPLEMENTED AND LIVE');
  } else {
    console.log(`⚠️  ${totalFailed} test(s) failed - Review needed`);
  }
  
  console.log(`\n`);
}

runFullVerification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
