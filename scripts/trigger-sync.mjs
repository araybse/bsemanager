#!/usr/bin/env node
/**
 * Reliable automation for triggering IRIS sync using Playwright
 */

import { chromium } from 'playwright'

async function triggerSync() {
  console.log('🚀 Starting IRIS sync automation...\n')
  
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to IRIS settings
    console.log('📍 Navigating to IRIS Settings...')
    await page.goto('https://bsemanager.vercel.app/settings', { waitUntil: 'networkidle' })
    
    // Wait for page to load
    await page.waitForTimeout(2000)
    
    // Look for sync button - try multiple possible selectors
    console.log('🔍 Looking for Sync button...')
    
    const syncButton = await page.locator('button:has-text("Sync")').or(
      page.locator('button:has-text("sync")').or(
        page.locator('button[aria-label*="sync" i]')
      )
    ).first()
    
    if (await syncButton.count() === 0) {
      console.log('❌ Could not find Sync button')
      console.log('📸 Taking screenshot for debugging...')
      await page.screenshot({ path: '/tmp/iris-settings-debug.png' })
      console.log('   Screenshot saved to: /tmp/iris-settings-debug.png')
      return false
    }
    
    console.log('✅ Found Sync button!')
    console.log('👆 Clicking Sync button...')
    await syncButton.click()
    
    // Wait for sync to complete (look for success message or button to re-enable)
    console.log('⏳ Waiting for sync to complete...')
    await page.waitForTimeout(5000) // Give it 5 seconds minimum
    
    // Check for completion indicators
    const successIndicators = [
      page.locator('text=/sync.*complete/i'),
      page.locator('text=/success/i'),
      page.locator('[role="status"]:has-text("Success")')
    ]
    
    let completed = false
    for (const indicator of successIndicators) {
      if (await indicator.count() > 0) {
        completed = true
        break
      }
    }
    
    if (completed) {
      console.log('✅ Sync completed successfully!')
    } else {
      console.log('⚠️  Sync may still be running or completed without visible indicator')
    }
    
    // Keep browser open for 3 seconds so you can see result
    await page.waitForTimeout(3000)
    
    return true
    
  } catch (error) {
    console.error('❌ Error during automation:', error.message)
    await page.screenshot({ path: '/tmp/iris-error.png' })
    console.log('📸 Error screenshot saved to: /tmp/iris-error.png')
    return false
  } finally {
    await browser.close()
  }
}

// Run it
triggerSync()
  .then(success => {
    console.log('')
    if (success) {
      console.log('🎉 Automation completed successfully!')
      process.exit(0)
    } else {
      console.log('⚠️  Automation completed with warnings')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
