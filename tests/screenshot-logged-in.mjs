#!/usr/bin/env node
/**
 * Capture IRIS dashboard using existing Chrome profile (stays logged in)
 */

import { chromium } from 'playwright'

async function capture() {
  console.log('🚀 Capturing IRIS dashboard (using your login session)...\n')

  // Connect to existing Chrome with your profile
  const browser = await chromium.connectOverCDP('http://localhost:9222').catch(async () => {
    // If that fails, launch with user data dir
    const userDataDir = '/Users/austinray/Library/Application Support/Google/Chrome'
    return await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome',
      viewport: { width: 1920, height: 1080 }
    })
  })

  const context = browser.contexts()[0] || await browser.newContext()
  const page = context.pages()[0] || await context.newPage()

  try {
    console.log('📍 Navigating to dashboard...')
    await page.goto('https://bsemanager.vercel.app/dashboard', { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    })
    
    await page.waitForTimeout(5000) // Let everything load

    console.log('📸 Taking screenshot...')
    await page.screenshot({ 
      path: '/tmp/iris-dashboard-logged-in.png', 
      fullPage: true 
    })
    
    console.log('✅ Screenshot saved: /tmp/iris-dashboard-logged-in.png')
    
    await page.waitForTimeout(2000)

  } catch (error) {
    console.error('❌ Error:', error.message)
    await page.screenshot({ path: '/tmp/iris-error.png' })
  } finally {
    if (browser.close) await browser.close()
  }
}

capture()
