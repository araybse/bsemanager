import { chromium } from 'playwright';

async function finalVerification() {
  console.log('🔍 Final Verification After Sync\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto('https://bsemanager.vercel.app');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'aray@blackstoneeng.com');
    await page.fill('input[type="password"]', 'BsE#2023admin');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/dashboard|accounting/, { timeout: 20000 });
    await page.waitForTimeout(3000);
    console.log('✅ Logged in\n');
    
    // Check QBO sync status
    console.log('1️⃣  Checking QBO Sync Status...');
    await page.goto('https://bsemanager.vercel.app/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("QBO")');
    await page.waitForTimeout(2000);
    
    const syncBtnText = await page.locator('button').filter({ hasText: /sync all/i }).first().textContent();
    console.log(`   Sync button: "${syncBtnText}"\n`);
    
    await page.screenshot({ path: '/tmp/final-qbo-status.png', fullPage: true });
    
    // Check Invoices
    console.log('2️⃣  Checking Invoices...');
    await page.goto('https://bsemanager.vercel.app/accounting');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Count status badges
    const allText = await page.textContent('body');
    const paidMatches = allText.match(/\bPaid\b/gi) || [];
    const unpaidMatches = allText.match(/\bUnpaid\b/gi) || [];
    
    console.log(`   Found "${paidMatches.length}" mentions of "Paid"`);
    console.log(`   Found "${unpaidMatches.length}" mentions of "Unpaid"\n`);
    
    await page.screenshot({ path: '/tmp/final-invoices.png', fullPage: true });
    
    // Check Time Entries  
    console.log('3️⃣  Checking Time Entries...');
    await page.goto('https://bsemanager.vercel.app/time-entries');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const timeText = await page.textContent('body');
    const billedMatches = timeText.match(/\bBilled\b/gi) || [];
    const unbilledMatches = timeText.match(/\bUnbilled\b/gi) || [];
    
    console.log(`   Found "${billedMatches.length}" mentions of "Billed"`);
    console.log(`   Found "${unbilledMatches.length}" mentions of "Unbilled"\n`);
    
    await page.screenshot({ path: '/tmp/final-time.png', fullPage: true });
    
    console.log('='.repeat(80));
    console.log('\n📊 FINAL RESULTS:\n');
    console.log(`Invoices: ${paidMatches.length} Paid, ${unpaidMatches.length} Unpaid`);
    console.log(`Time: ${billedMatches.length} Billed, ${unbilledMatches.length} Unbilled`);
    console.log(`\nLast sync: ${syncBtnText}`);
    console.log('\n📸 Screenshots: /tmp/final-*.png\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

finalVerification();
