#!/usr/bin/env node
/**
 * Connect to running Chrome and take screenshot
 */

import { chromium } from 'playwright'

async function capture() {
  console.log('🔌 Connecting to running Chrome...')
  
  try {
    // Chrome was launched with --remote-debugging-pipe
    // We need to find the WebSocket endpoint
    const browser = await chromium.connect('http://localhost:9222').catch(async () => {
      console.log('   Trying alternative connection...')
      // Try to get the browser that Playwright launched
      const contexts = global._playwrightContexts || []
      if (contexts.length > 0) {
        return contexts[0]._browser
      }
      throw new Error('Could not connect to Chrome')
    })

    console.log('✅ Connected!')
    
    const contexts = browser.contexts()
    console.log(`   Found ${contexts.length} context(s)`)
    
    const context = contexts[0]
    const pages = context.pages()
    console.log(`   Found ${pages.length} page(s)`)
    
    const page = pages[0]
    
    console.log('📍 Navigating to dashboard...')
    await page.goto('https://bsemanager.vercel.app/dashboard', { waitUntil: 'networkidle' })
    await page.waitForTimeout(5000)
    
    console.log('📸 Taking screenshot...')
    await page.screenshot({ path: '/tmp/iris-dashboard-cdp.png', fullPage: true })
    console.log('✅ Done!')
    
    return '/tmp/iris-dashboard-cdp.png'
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  }
}

capture()
  .then(path => console.log(`Screenshot: ${path}`))
  .catch(error => {
    console.error('Failed:', error.message)
    process.exit(1)
  })
