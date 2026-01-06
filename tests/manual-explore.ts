import { chromium } from 'playwright'

async function main() {
  // Launch browser in headed mode
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000, // Slow down actions for visibility
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()

  // Navigate to login page
  await page.goto('http://localhost:3000/auth/login')

  console.log('\n=================================')
  console.log('Browser opened!')
  console.log('Please login manually with:')
  console.log('  Email: admin@pusat.com')
  console.log('  Password: 123123')
  console.log('=================================\n')

  // Wait for user to navigate to dashboard (timeout 5 minutes)
  await page.waitForURL('**/dashboard', { timeout: 300000 })

  console.log('\n✓ Detected dashboard navigation!')
  console.log('Taking screenshots of various pages...\n')

  // Wait a bit for everything to load
  await page.waitForTimeout(2000)

  // Screenshot dashboard
  await page.screenshot({ path: 'screenshots/01-dashboard.png', fullPage: true })
  console.log('✓ Dashboard screenshot saved')

  // Try to navigate to different sections
  const sections = [
    { name: 'KTA List', selector: 'a[href*="/dashboard/kta"]', file: '02-kta-list.png' },
    { name: 'Payments', selector: 'a[href*="payment"]', file: '03-payments.png' },
    { name: 'Waiting Approval', selector: 'a[href*="waiting"]', file: '04-waiting-approval.png' },
  ]

  for (const section of sections) {
    try {
      const element = page.locator(section.selector).first()
      if (await element.isVisible({ timeout: 3000 })) {
        await element.click()
        await page.waitForTimeout(2000)
        await page.screenshot({ path: `screenshots/${section.file}`, fullPage: true })
        console.log(`✓ ${section.name} screenshot saved`)

        // Go back to dashboard
        await page.goto('http://localhost:3000/dashboard')
        await page.waitForTimeout(1500)
      }
    } catch (e) {
      console.log(`✗ ${section.name} not found or not accessible`)
    }
  }

  // Analyze the page structure
  console.log('\n=== Page Analysis ===')
  const title = await page.title()
  console.log('Page Title:', title)

  const navItems = await page.locator('nav a, [role="navigation"] a').allTextContents()
  console.log('\nNavigation Items:', navItems.filter(Boolean))

  const cards = await page.locator('[class*="card"], [class*="stat"]').count()
  console.log('\nNumber of cards/elements:', cards)

  const charts = await page.locator('svg').count()
  console.log('Number of charts (SVG):', charts)

  console.log('\n✓ All screenshots saved to screenshots/ folder')
  console.log('\nPress Ctrl+C to close browser, or wait 30 seconds for auto-close...')

  // Keep browser open for 30 more seconds for manual exploration
  await page.waitForTimeout(30000)

  await browser.close()
}

main().catch(console.error)
