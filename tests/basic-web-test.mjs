import { chromium } from 'playwright'

console.log('1️⃣ Launching browser...')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

console.log('2️⃣ Navigating to Google...')
await page.goto('https://www.google.com')

console.log('3️⃣ Taking screenshot...')
await page.screenshot({ path: '/tmp/test-google.png' })

console.log('4️⃣ Navigating to Wikipedia...')
await page.goto('https://www.wikipedia.org')

console.log('5️⃣ Taking screenshot...')
await page.screenshot({ path: '/tmp/test-wikipedia.png' })

await browser.close()
console.log('✅ Done! Screenshots saved to /tmp/')
