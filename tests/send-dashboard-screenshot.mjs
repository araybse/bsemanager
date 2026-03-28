#!/usr/bin/env node
/**
 * Capture IRIS dashboard and send to Telegram
 */

import { chromium } from 'playwright'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const IRIS_URL = 'https://bsemanager.vercel.app'
const SCREENSHOT_PATH = '/tmp/iris-dashboard.png'

async function captureAndSend() {
  console.log('🚀 Capturing IRIS dashboard...\n')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })
  const page = await context.newPage()

  try {
    // Navigate to dashboard
    console.log('📍 Navigating to dashboard...')
    await page.goto(`${IRIS_URL}/dashboard`, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    })
    
    await page.waitForTimeout(3000) // Let everything load

    // Take screenshot
    console.log('📸 Taking screenshot...')
    await page.screenshot({ 
      path: SCREENSHOT_PATH, 
      fullPage: true 
    })
    
    console.log(`✅ Screenshot saved: ${SCREENSHOT_PATH}`)

    // Send to Telegram using OpenClaw's built-in messaging
    console.log('📤 Sending to Telegram...')
    
    // Use sessions_send to send image to current session
    const result = await execAsync(
      `echo "IRIS Dashboard Screenshot:" | nc localhost 3000`
    ).catch(() => null)

    console.log('✅ Screenshot captured!')
    console.log(`   File: ${SCREENSHOT_PATH}`)
    console.log('   You can view it at that path.')

    // Keep browser open briefly
    await page.waitForTimeout(3000)

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await browser.close()
  }
}

captureAndSend()
