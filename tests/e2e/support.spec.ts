import { expect, test } from '@playwright/test'
import {
  SUPPORT_DISMISS_STORAGE_KEY,
  readDismissedAt,
  recordDismissal,
  shouldShowSupportPrompt,
} from '../../src/support/supportPrompt'
import { SUPPORT_CONFIG } from '../../src/config/support'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

test.describe('supportPrompt pure logic', () => {
  test('shows the prompt when the feature is enabled and never dismissed', () => {
    expect(shouldShowSupportPrompt(Date.now(), null, true)).toBe(true)
  })

  test('never shows the prompt when the feature is disabled, regardless of dismissal state', () => {
    expect(shouldShowSupportPrompt(Date.now(), null, false)).toBe(false)
  })

  test('suppresses the prompt immediately after a dismissal', () => {
    const now = Date.now()
    expect(shouldShowSupportPrompt(now, now, true)).toBe(false)
  })

  test('stays suppressed just before the 7-day window elapses', () => {
    const now = Date.now()
    const dismissedAt = now - (7 * ONE_DAY_MS - 1000)
    expect(shouldShowSupportPrompt(now, dismissedAt, true)).toBe(false)
  })

  test('shows the prompt again once 7 days have elapsed', () => {
    const now = Date.now()
    const dismissedAt = now - 7 * ONE_DAY_MS
    expect(shouldShowSupportPrompt(now, dismissedAt, true)).toBe(true)
  })

  test('readDismissedAt returns null and does not throw when storage is unavailable', () => {
    expect(() => readDismissedAt()).not.toThrow()
    expect(readDismissedAt()).toBeNull()
  })

  test('recordDismissal does not throw when storage is unavailable', () => {
    expect(() => recordDismissal(Date.now())).not.toThrow()
  })

  test('exports the storage key as a stable constant', () => {
    expect(SUPPORT_DISMISS_STORAGE_KEY).toBe('littleHelloSupportDismissedAt')
  })
})

test.describe('support panel and footer link', () => {
  test('shows the support panel after a successful download', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('A card worth keeping.')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    await downloadPromise

    await expect(page.getByRole('region', { name: 'Support Little Hello prompt' })).toBeVisible()
  })

  test('shows the support panel after successfully copying the share link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-write'])
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('A card worth keeping.')
    await page.getByRole('button', { name: 'Copy Link' }).click()

    await expect(page.getByRole('status')).toHaveText('Link copied!')
    await expect(page.getByRole('region', { name: 'Support Little Hello prompt' })).toBeVisible()
  })

  test('the support CTA opens the configured Ko-fi URL safely in a new tab', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('A card worth keeping.')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    await downloadPromise

    const panel = page.getByRole('region', { name: 'Support Little Hello prompt' })
    const cta = panel.getByRole('link', { name: 'Support Little Hello' })
    await expect(cta).toHaveAttribute('href', SUPPORT_CONFIG.url)
    await expect(cta).toHaveAttribute('target', '_blank')
    await expect(cta).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('dismissing the panel hides it and prevents it reappearing on the next visit', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('A card worth keeping.')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    await downloadPromise

    const panel = page.getByRole('region', { name: 'Support Little Hello prompt' })
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: 'Dismiss support message' }).click()
    await expect(panel).toBeHidden()

    await page.reload()
    await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('Another card worth keeping.')
    const secondDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    await secondDownload

    await expect(page.getByRole('region', { name: 'Support Little Hello prompt' })).not.toBeAttached()
  })

  test('reshows the support panel once the 7-day suppression window has elapsed', async ({ page }) => {
    await page.goto('/')
    await page.evaluate((key) => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      localStorage.setItem(key, String(eightDaysAgo))
    }, SUPPORT_DISMISS_STORAGE_KEY)

    await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('A card worth keeping.')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    await downloadPromise

    await expect(page.getByRole('region', { name: 'Support Little Hello prompt' })).toBeVisible()
  })

  test('shows the footer link on the editor, shared-success, and shared-error views', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Support Little Hello' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('Happy birthday!')
    const url = await page.getByRole('textbox', { name: 'Share link' }).inputValue()
    await page.goto(url)
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Support Little Hello' })).toBeVisible()

    await page.goto('/#/card/not-a-valid-card')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Support Little Hello' })).toBeVisible()
  })

  test('support panel causes no horizontal overflow at 360px and keeps the CTA touch-sized', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('A card worth keeping.')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    await downloadPromise

    const panel = page.getByRole('region', { name: 'Support Little Hello prompt' })
    await expect(panel).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const ctaBox = await panel.getByRole('link', { name: 'Support Little Hello' }).boundingBox()
    await context.close()

    expect(overflow, `page overflowed horizontally by ${overflow}px at a 360px viewport width`).toBeLessThanOrEqual(0)
    expect(ctaBox?.height ?? 0).toBeGreaterThanOrEqual(44)
  })
})
