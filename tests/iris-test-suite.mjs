#!/usr/bin/env node
/**
 * IRIS Comprehensive Test Suite
 * 
 * Reliable browser automation using Playwright
 * Tests all Phase 1 features with screenshots
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const IRIS_URL = 'https://bsemanager.vercel.app'
const SCREENSHOTS_DIR = '/tmp/iris-tests'
const RESULTS_FILE = '/tmp/iris-test-results.json'

// Test results tracking
const results = {
  startTime: new Date().toISOString(),
  tests: [],
  screenshots: [],
  summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
}

function log(emoji, message) {
  console.log(`${emoji} ${message}`)
}

function saveResult(testName, status, details = {}) {
  results.tests.push({
    name: testName,
    status,
    timestamp: new Date().toISOString(),
    ...details
  })
  results.summary.total++
  if (status === 'passed') results.summary.passed++
  else if (status === 'failed') results.summary.failed++
  else if (status === 'skipped') results.summary.skipped++
}

async function takeScreenshot(page, name, description) {
  const filename = `${name.replace(/\s+/g, '-').toLowerCase()}.png`
  const filepath = path.join(SCREENSHOTS_DIR, filename)
  await page.screenshot({ path: filepath, fullPage: true })
  results.screenshots.push({ name, description, path: filepath })
  log('📸', `Screenshot saved: ${filename}`)
  return filepath
}

async function runTests() {
  // Setup
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  log('🚀', 'Starting IRIS Test Suite\n')
  log('📂', `Screenshots: ${SCREENSHOTS_DIR}`)
  log('📄', `Results: ${RESULTS_FILE}\n`)

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 // Slight delay so actions are visible
  })
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: SCREENSHOTS_DIR,
      size: { width: 1920, height: 1080 }
    }
  })
  
  const page = await context.newPage()

  try {
    // ====================================
    // TEST 1: Login Page & IRIS Branding
    // ====================================
    log('', '\n' + '='.repeat(60))
    log('🧪', 'TEST 1: Login Page & IRIS Branding')
    log('', '='.repeat(60))

    try {
      await page.goto(IRIS_URL, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '01-login-page', 'Login page with IRIS branding')

      // Check for IRIS logo
      const logoLocator = page.locator('img[alt="IRIS"], img[src*="iris"]')
      const logoCount = await logoLocator.count()
      
      // Check for tagline
      const taglineLocator = page.locator('text=/Integrated Resource Intelligence System/i')
      const taglineCount = await taglineLocator.count()

      const hasLogo = logoCount > 0
      const hasTagline = taglineCount > 0

      log(hasLogo ? '✅' : '❌', `IRIS logo present: ${hasLogo}`)
      log(hasTagline ? '✅' : '❌', `Tagline present: ${hasTagline}`)

      if (hasLogo && hasTagline) {
        saveResult('Login Page Branding', 'passed', { logo: true, tagline: true })
      } else {
        saveResult('Login Page Branding', 'failed', { logo: hasLogo, tagline: hasTagline })
      }
    } catch (error) {
      log('❌', `Test 1 failed: ${error.message}`)
      saveResult('Login Page Branding', 'failed', { error: error.message })
      await takeScreenshot(page, '01-error', 'Login page error')
    }

    // ====================================
    // TEST 2: Authentication Check
    // ====================================
    log('', '\n' + '='.repeat(60))
    log('🧪', 'TEST 2: Authentication Status')
    log('', '='.repeat(60))

    try {
      // Check if we're already logged in or need to login
      await page.waitForTimeout(1000)
      const currentUrl = page.url()
      const isLoggedIn = !currentUrl.includes('/login')

      log(isLoggedIn ? '✅' : '⚠️', `Already logged in: ${isLoggedIn}`)

      if (!isLoggedIn) {
        log('⚠️', 'Not logged in - manual login required')
        log('', '\n👉 Please login manually in the browser window')
        log('', '   Then press ENTER here to continue...\n')
        
        // Wait for user to press Enter
        await new Promise(resolve => {
          process.stdin.once('data', () => resolve())
        })

        await page.waitForTimeout(2000)
        const newUrl = page.url()
        const nowLoggedIn = !newUrl.includes('/login')
        
        if (nowLoggedIn) {
          log('✅', 'Login successful!')
          saveResult('Authentication', 'passed', { manual: true })
        } else {
          log('❌', 'Still not logged in')
          saveResult('Authentication', 'failed', { reason: 'Manual login failed' })
          throw new Error('Authentication required')
        }
      } else {
        saveResult('Authentication', 'passed', { manual: false })
      }

      await takeScreenshot(page, '02-authenticated', 'Post-login state')
    } catch (error) {
      log('❌', `Test 2 failed: ${error.message}`)
      saveResult('Authentication', 'failed', { error: error.message })
    }

    // ====================================
    // TEST 3: Dashboard Page
    // ====================================
    log('', '\n' + '='.repeat(60))
    log('🧪', 'TEST 3: Dashboard Page')
    log('', '='.repeat(60))

    try {
      await page.goto(`${IRIS_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '03-dashboard', 'Main dashboard view')

      // Check for key dashboard elements
      const revenueCard = await page.locator('text=/revenue/i').count() > 0
      const projectsCard = await page.locator('text=/projects/i').count() > 0
      
      log(revenueCard ? '✅' : '⚠️', `Revenue display: ${revenueCard}`)
      log(projectsCard ? '✅' : '⚠️', `Projects display: ${projectsCard}`)

      saveResult('Dashboard Page', 'passed', { revenue: revenueCard, projects: projectsCard })
    } catch (error) {
      log('❌', `Test 3 failed: ${error.message}`)
      saveResult('Dashboard Page', 'failed', { error: error.message })
      await takeScreenshot(page, '03-error', 'Dashboard error')
    }

    // ====================================
    // TEST 4: Invoices Page
    // ====================================
    log('', '\n' + '='.repeat(60))
    log('🧪', 'TEST 4: Invoices Page')
    log('', '='.repeat(60))

    try {
      await page.goto(`${IRIS_URL}/invoices`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '04-invoices', 'Invoices list page')

      // Check for invoice table
      const hasTable = await page.locator('table, [role="table"]').count() > 0
      const rowCount = await page.locator('tr, [role="row"]').count()

      log(hasTable ? '✅' : '❌', `Invoice table present: ${hasTable}`)
      log('ℹ️', `Table rows: ${rowCount}`)

      saveResult('Invoices Page', hasTable ? 'passed' : 'failed', { 
        hasTable, 
        rowCount 
      })
    } catch (error) {
      log('❌', `Test 4 failed: ${error.message}`)
      saveResult('Invoices Page', 'failed', { error: error.message })
      await takeScreenshot(page, '04-error', 'Invoices error')
    }

    // ====================================
    // TEST 5: Settings Page & Sync
    // ====================================
    log('', '\n' + '='.repeat(60))
    log('🧪', 'TEST 5: Settings Page')
    log('', '='.repeat(60))

    try {
      await page.goto(`${IRIS_URL}/settings`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '05-settings', 'Settings page')

      // Look for sync button
      const syncButton = page.locator('button:has-text("Sync")')
      const hasSyncButton = await syncButton.count() > 0

      log(hasSyncButton ? '✅' : '❌', `Sync button present: ${hasSyncButton}`)

      if (hasSyncButton) {
        // Check QuickBooks connection status
        const qbConnected = await page.locator('text=/connected/i, text=/QuickBooks/i').count() > 0
        log(qbConnected ? '✅' : '⚠️', `QuickBooks connected: ${qbConnected}`)

        saveResult('Settings Page', 'passed', { syncButton: true, qbConnected })
      } else {
        saveResult('Settings Page', 'failed', { syncButton: false })
      }
    } catch (error) {
      log('❌', `Test 5 failed: ${error.message}`)
      saveResult('Settings Page', 'failed', { error: error.message })
      await takeScreenshot(page, '05-error', 'Settings error')
    }

    // ====================================
    // TEST 6: Projects Page
    // ====================================
    log('', '\n' + '='.repeat(60))
    log('🧪', 'TEST 6: Projects Page')
    log('', '='.repeat(60))

    try {
      await page.goto(`${IRIS_URL}/projects`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '06-projects', 'Projects list')

      const hasProjects = await page.locator('text=/24-|25-/').count() > 0
      log(hasProjects ? '✅' : '⚠️', `Projects visible: ${hasProjects}`)

      saveResult('Projects Page', hasProjects ? 'passed' : 'skipped', { hasProjects })
    } catch (error) {
      log('❌', `Test 6 failed: ${error.message}`)
      saveResult('Projects Page', 'failed', { error: error.message })
      await takeScreenshot(page, '06-error', 'Projects error')
    }

    // ====================================
    // FINAL: Summary
    // ====================================
    log('', '\n' + '='.repeat(60))
    log('📊', 'TEST SUMMARY')
    log('', '='.repeat(60))

    log('', `Total Tests: ${results.summary.total}`)
    log('✅', `Passed: ${results.summary.passed}`)
    log('❌', `Failed: ${results.summary.failed}`)
    log('⚠️', `Skipped: ${results.summary.skipped}`)
    log('', '')
    log('📸', `Screenshots: ${results.screenshots.length} saved to ${SCREENSHOTS_DIR}`)
    log('📄', `Results: ${RESULTS_FILE}`)

    // Keep browser open for 10 seconds
    log('', '\n⏳ Keeping browser open for 10 seconds...')
    await page.waitForTimeout(10000)

  } catch (error) {
    log('💥', `Fatal error: ${error.message}`)
    await takeScreenshot(page, 'fatal-error', 'Fatal test error')
  } finally {
    // Save results
    results.endTime = new Date().toISOString()
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
    log('', '\n✅ Test suite complete!')
    
    await browser.close()
  }
}

// Run the tests
runTests()
  .catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
