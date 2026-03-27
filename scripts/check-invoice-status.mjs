#!/usr/bin/env node
/**
 * Check if invoice 27-xx-xx is deleted in IRIS
 */

import { chromium } from 'playwright'

async function checkInvoiceStatus() {
  console.log('🔍 Checking invoice 27-xx-xx status in IRIS...\n')
  
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to IRIS invoices page
    console.log('📍 Navigating to IRIS Invoices page...')
    await page.goto('https://bsemanager.vercel.app/invoices', { waitUntil: 'networkidle' })
    
    // Wait for page to load
    await page.waitForTimeout(3000)
    
    // Search for the invoice number
    console.log('🔎 Looking for invoice 27-xx-xx...')
    
    // Try to find the invoice in the table
    const invoiceRow = page.locator('tr:has-text("27-xx-xx")')
    const count = await invoiceRow.count()
    
    if (count === 0) {
      console.log('✅ Invoice NOT found in table (either deleted or filtered out)')
      console.log('📸 Taking screenshot for confirmation...')
      await page.screenshot({ path: '/tmp/iris-invoices-no-invoice.png', fullPage: true })
      console.log('   Screenshot: /tmp/iris-invoices-no-invoice.png')
      return { found: false }
    }
    
    console.log(`✅ Found ${count} row(s) with invoice 27-xx-xx`)
    
    // Check if it has "deleted" status
    const deletedBadge = invoiceRow.locator('text=/deleted/i')
    const hasDeletedStatus = await deletedBadge.count() > 0
    
    // Get the full row text for analysis
    const rowText = await invoiceRow.first().textContent()
    
    console.log('\n📋 Invoice Details:')
    console.log('   Row text:', rowText)
    console.log('   Has "deleted" status:', hasDeletedStatus ? 'YES ✅' : 'NO ❌')
    
    // Take screenshot
    console.log('\n📸 Taking screenshot...')
    await page.screenshot({ path: '/tmp/iris-invoices-found.png', fullPage: true })
    console.log('   Screenshot: /tmp/iris-invoices-found.png')
    
    // Keep browser open for 3 seconds
    await page.waitForTimeout(3000)
    
    return {
      found: true,
      hasDeletedStatus,
      rowText
    }
    
  } catch (error) {
    console.error('❌ Error during check:', error.message)
    await page.screenshot({ path: '/tmp/iris-check-error.png' })
    console.log('📸 Error screenshot: /tmp/iris-check-error.png')
    return { error: error.message }
  } finally {
    await browser.close()
  }
}

// Run it
checkInvoiceStatus()
  .then(result => {
    console.log('\n🎯 RESULT:')
    if (result.error) {
      console.log('   ❌ Error occurred:', result.error)
      process.exit(1)
    } else if (!result.found) {
      console.log('   ✅ Invoice 27-xx-xx is NOT visible (likely deleted or filtered)')
      process.exit(0)
    } else if (result.hasDeletedStatus) {
      console.log('   ✅ Invoice 27-xx-xx is marked as DELETED!')
      process.exit(0)
    } else {
      console.log('   ⚠️  Invoice 27-xx-xx is still active (NOT deleted)')
      console.log('   Delete sync may not have run yet or failed.')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
