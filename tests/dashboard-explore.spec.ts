import { test, expect } from '@playwright/test'

test.describe('Dashboard Exploration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/login')

    // Fill in login credentials
    await page.fill('input[name="email"]', 'admin@pusat.com')
    await page.fill('input[name="password"]', '123123')

    // Click login button
    await page.click('button[type="submit"]')

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('Dashboard Overview', async ({ page }) => {
    // Take screenshot of dashboard
    await page.screenshot({ path: 'screenshots/dashboard.png', fullPage: true })
    console.log('Screenshot saved: screenshots/dashboard.png')
  })

  test('Explore KTA List', async ({ page }) => {
    // Click on KTA menu item
    await page.click('text=KTA')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Take screenshot
    await page.screenshot({ path: 'screenshots/kta-list.png', fullPage: true })
    console.log('Screenshot saved: screenshots/kta-list.png')
  })

  test('Explore Payments', async ({ page }) => {
    // Click on Payments menu
    const paymentsLink = page.getByText('Pembayaran').or(page.getByText('Payments')).or(page.locator('a[href*="payment"]'))
    if (await paymentsLink.isVisible()) {
      await paymentsLink.first().click()
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: 'screenshots/payments.png', fullPage: true })
      console.log('Screenshot saved: screenshots/payments.png')
    }
  })

  test('Explore Waiting Approval', async ({ page }) => {
    // Click on Waiting Approval
    const approvalLink = page.getByText('Menunggu Persetujuan').or(page.getByText('Waiting')).or(page.locator('a[href*="waiting"]'))
    if (await approvalLink.isVisible()) {
      await approvalLink.first().click()
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: 'screenshots/waiting-approval.png', fullPage: true })
      console.log('Screenshot saved: screenshots/waiting-approval.png')
    }
  })

  test('Analyze Dashboard Layout', async ({ page }) => {
    // Get page title
    const title = await page.title()
    console.log('Page Title:', title)

    // Check navigation items
    const navItems = await page.locator('nav a').allTextContents()
    console.log('Navigation Items:', navItems)

    // Check stats cards
    const statsCards = await page.locator('[class*="card"], [class*="stat"]').count()
    console.log('Number of cards:', statsCards)

    // Check if there are charts
    const charts = await page.locator('svg').count()
    console.log('Number of SVG elements (charts):', charts)

    // Take a compact screenshot
    await page.screenshot({ path: 'screenshots/dashboard-compact.png' })
  })
})
