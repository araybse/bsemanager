#!/usr/bin/env node
/**
 * Capture IRIS dashboard using Austin's Chrome profile (already logged in)
 */

import { chromium } from 'playwright'
import fs from 'fs'

async function capture() {
  console.log('🚀 Launching Chrome with your profile...\n')

  const userDataDir = '/Users/austinray/Library/Application Support/Google/Chrome'
  
  // Launch Chrome with your profile (keeps you logged in)
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox']
  })

  const page = context.pages()[0] || await context.newPage()

  try {
    console.log('📍 Navigating to IRIS dashboard...')
    await page.goto('https://bsemanager.vercel.app/dashboard', { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    })
    
    console.log('⏳ Waiting for page to fully load...')
    await page.waitForTimeout(5000)

    // Check if we're on login page or dashboard
    const url = page.url()
    console.log(`   Current URL: ${url}`)

    if (url.includes('/login')) {
      console.log('🔐 On login page - need to login first')
      
      // Wait a bit to see if auto-login happens
      await page.waitForTimeout(3000)
      
      // Check again
      const newUrl = page.url()
      if (newUrl.includes('/login')) {
        console.log('⚠️  Still on login - checking for saved credentials...')
        
        // Click email field and wait for autofill
        await page.click('input[type="email"], input[name="email"]').catch(() => {})
        await page.waitForTimeout(2000)
        
        // Try to submit if credentials are filled
        const submitButton = page.locator('button[type="submit"]')
        const hasButton = await submitButton.count() > 0
        
        if (hasButton) {
          console.log('🔑 Attempting auto-login...')
          await submitButton.click()
          await page.waitForTimeout(5000)
        }
      }
    }

    const finalUrl = page.url()
    console.log(`   Final URL: ${finalUrl}`)
    
    console.log('📸 Taking screenshot...')
    const screenshotPath = '/tmp/iris-dashboard-authenticated.png'
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    })
    
    console.log(`✅ Screenshot saved: ${screenshotPath}`)
    console.log(`   File size: ${fs.statSync(screenshotPath).size} bytes`)
    
    // Return the path so we can send it
    return screenshotPath

  } catch (error) {
    console.error('❌ Error:', error.message)
    const errorPath = '/tmp/iris-error.png'
    await page.screenshot({ path: errorPath }).catch(() => {})
    return errorPath
  } finally {
    console.log('\n⏳ Keeping browser open for 3 seconds...')
    await page.waitForTimeout(3000)
    await context.close()
  }
}

capture()
  .then(path => {
    console.log(`\n✅ Done! Screenshot at: ${path}`)
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
