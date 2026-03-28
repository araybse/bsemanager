#!/usr/bin/env node
/**
 * Fully automated IRIS test with login
 * Just needs email and password as environment variables
 */

import { chromium } from 'playwright'

// Get credentials from environment or use defaults
const email = process.env.IRIS_TEST_EMAIL || 'aray@blackstoneeng.com'
const password = process.env.IRIS_TEST_PASSWORD || '' // You'll need to provide this

async function testIRIS() {
  console.log('🚀 Starting fully automated IRIS test...\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

  try {
    // 1. Go to IRIS
    console.log('1️⃣ Navigating to IRIS...')
    await page.goto('https://bsemanager.vercel.app')
    await page.screenshot({ path: '/tmp/iris-01-login.png' })

    // 2. Login
    console.log('2️⃣ Logging in...')
    await page.fill('input[type="email"]', email)
    
    if (password) {
      await page.fill('input[type="password"]', password)
      await page.click('button[type="submit"]')
      await page.waitForNavigation({ waitUntil: 'networkidle' })
      await page.screenshot({ path: '/tmp/iris-02-logged-in.png' })
    } else {
      console.log('   ⚠️  No password provided, skipping login')
    }

    // 3. Dashboard
    console.log('3️⃣ Checking dashboard...')
    await page.goto('https://bsemanager.vercel.app/dashboard')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: '/tmp/iris-03-dashboard.png' })

    // 4. Invoices
    console.log('4️⃣ Checking invoices...')
    await page.goto('https://bsemanager.vercel.app/invoices')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '/tmp/iris-04-invoices.png' })

    // 5. Settings
    console.log('5️⃣ Checking settings...')
    await page.goto('https://bsemanager.vercel.app/settings')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '/tmp/iris-05-settings.png' })

    console.log('\n✅ All tests complete!')
    console.log('📸 Screenshots saved to /tmp/iris-*.png')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    await page.screenshot({ path: '/tmp/iris-error.png' })
  } finally {
    await browser.close()
  }
}

testIRIS()
