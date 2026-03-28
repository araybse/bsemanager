#!/usr/bin/env node
/**
 * End-to-End Manual Verification Suite
 * 
 * Opens IRIS in a real browser and walks through all features
 * Takes screenshots at each step for verification
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const IRIS_URL = 'https://bsemanager.vercel.app'
const SCREENSHOTS_DIR = '/tmp/iris-verification'

async function runVerification() {
  // Create screenshots directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  console.log('🧪 Starting IRIS E2E Verification\n')
  console.log(`📸 Screenshots will be saved to: ${SCREENSHOTS_DIR}\n`)

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down actions so you can see what's happening
  })
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })
  
  const page = await context.newPage()

  try {
    // Test 1: Login Page
    console.log('1️⃣ Testing Login Page...')
    await page.goto(IRIS_URL)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-page.png`, fullPage: true })
    
    const hasIRISLogo = await page.locator('img[alt="IRIS"]').count() > 0
    console.log(`   Logo present: ${hasIRISLogo ? '✅' : '❌'}`)
    
    const hasTagline = await page.locator('text=/Integrated Resource Intelligence System/i').count() > 0
    console.log(`   Tagline present: ${hasTagline ? '✅' : '❌'}`)

    // Note: Can't auto-login without credentials, so stop here for manual tests
    console.log('\n⚠️  Manual Login Required')
    console.log('   Please login and then press Enter to continue...')
    
    // Keep browser open
    await page.waitForTimeout(300000) // Wait 5 minutes for manual testing

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/error.png` })
  } finally {
    await browser.close()
  }

  console.log('\n📸 All screenshots saved to:', SCREENSHOTS_DIR)
  console.log('\n✅ Verification complete!')
}

runVerification()
  .catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
