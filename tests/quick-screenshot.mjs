import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto('https://bsemanager.vercel.app/dashboard', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: '/tmp/iris-dashboard.png', fullPage: true })
console.log('Screenshot saved: /tmp/iris-dashboard.png')
await browser.close()
