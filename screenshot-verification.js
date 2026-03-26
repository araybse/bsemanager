const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const testUsers = [
  { email: 'aburke@blackstoneeng.com', password: 'BsE#2023AB', role: 'project_manager', name: 'Austin Burke' },
  { email: 'ameta@blackstoneeng.com', password: 'BsE#2023AM', role: 'employee', name: 'Arber Meta' },
];

const screenshotDir = '/tmp/bsemanager-screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function takeScreenshots() {
  for (const user of testUsers) {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    page.setViewportSize({ width: 1440, height: 900 });
    
    console.log(`\n📸 Testing ${user.name} (${user.role})...\n`);
    
    // Login
    await page.goto('https://bsemanager.vercel.app/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // 1. Dashboard screenshot
    console.log(`  1️⃣ Dashboard access...`);
    await page.goto('https://bsemanager.vercel.app/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const dashUrl = page.url();
    console.log(`     URL: ${dashUrl}`);
    const dashPath = path.join(screenshotDir, `01_${user.name.replace(' ', '_')}_dashboard.png`);
    await page.screenshot({ path: dashPath, fullPage: false });
    console.log(`     ✓ Screenshot: ${dashPath}`);
    
    // 2. Sidebar navigation
    console.log(`\n  2️⃣ Sidebar navigation...`);
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
    console.log(`     Visible: ${navItems.join(', ') || '(None)'}`);
    
    // 3. Projects page
    console.log(`\n  3️⃣ Projects page...`);
    await page.goto('https://bsemanager.vercel.app/projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const projUrl = page.url();
    console.log(`     URL: ${projUrl}`);
    const projPath = path.join(screenshotDir, `02_${user.name.replace(' ', '_')}_projects.png`);
    await page.screenshot({ path: projPath, fullPage: false });
    console.log(`     ✓ Screenshot: ${projPath}`);
    
    if (user.role !== 'employee') {
      // 4. Invoices page (PM can access)
      console.log(`\n  4️⃣ Invoices page...`);
      await page.goto('https://bsemanager.vervel.app/invoices', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const invUrl = page.url();
      console.log(`     URL: ${invUrl}`);
      if (invUrl.includes('invoices')) {
        const invPath = path.join(screenshotDir, `03_${user.name.replace(' ', '_')}_invoices.png`);
        await page.screenshot({ path: invPath, fullPage: false });
        console.log(`     ✓ Screenshot: ${invPath}`);
      }
    } else {
      // 4. Try accessing admin page
      console.log(`\n  4️⃣ Try accessing Accounting (should redirect)...`);
      await page.goto('https://bsemanager.vercel.app/accounting', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const acctUrl = page.url();
      console.log(`     Tried: /accounting`);
      console.log(`     Redirected to: ${acctUrl}`);
      const acctPath = path.join(screenshotDir, `03_${user.name.replace(' ', '_')}_accounting_redirect.png`);
      await page.screenshot({ path: acctPath, fullPage: false });
      console.log(`     ✓ Screenshot: ${acctPath}`);
    }
    
    await browser.close();
  }
  
  console.log(`\n✅ Screenshots saved to: ${screenshotDir}`);
  console.log(`   Check /tmp/bsemanager-screenshots/ for images\n`);
}

takeScreenshots().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
