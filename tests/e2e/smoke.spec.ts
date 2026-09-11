import { expect, test } from '@playwright/test'

test('creates a card and updates the live preview', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Make someone’s day.' })).toBeVisible()
  await page.getByRole('button', { name: 'Thank you' }).click()
  await page.getByRole('button', { name: 'Choose Bloom design' }).click()
  await page.getByRole('textbox', { name: 'To optional' }).fill('Grandma')
  await page.getByRole('textbox', { name: /Your message/ }).fill('Thank you for always being there.')
  await page.getByRole('textbox', { name: 'From optional' }).fill('Nouri')

  const preview = page.getByRole('complementary', { name: 'Live card preview' })
  await expect(preview).toContainText('Grandma')
  await expect(preview).toContainText('Thank you for always being there.')
  await expect(preview).toContainText('— Nouri')
})

test('generates a share URL and opens the shared card view', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Choose Sunshine design' }).click()
  await page.getByRole('textbox', { name: 'To optional' }).fill('Mom')
  await page.getByRole('textbox', { name: /Your message/ }).fill('Happy birthday!')
  await page.getByRole('textbox', { name: 'From optional' }).fill('Nouri')

  const shareLink = page.getByRole('textbox', { name: 'Share link' })
  const url = await shareLink.inputValue()
  expect(url).toContain('#/card/')

  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Mom, this is for you.' })).toBeVisible()
  await expect(page.getByRole('article')).toContainText('Happy birthday!')
  await expect(page.getByRole('link', { name: 'Create Your Own Card' })).toBeVisible()
})

test('handles malformed shared URLs without crashing', async ({ page }) => {
  await page.goto('/#/card/not-a-valid-card')
  await expect(page.getByRole('heading', { name: 'We couldn’t open this card.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Your Own Card' })).toBeVisible()
})

test('downloads a PNG from the editor', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Your message 0/500' }).fill('A card worth keeping.')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Card' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/little-hello-birthday-confetti-01\.png/)
})

test('applies an expressive message font and preserves it in shared cards', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: /Your message/ }).fill('A beautiful day for you.')

  const preview = page.getByRole('complementary', { name: 'Live card preview' })
  const before = await preview.locator('.preview-message').evaluate((element) => getComputedStyle(element).fontFamily)
  await page.locator('.font-option').filter({ hasText: 'Dancing Script' }).click()
  const after = await preview.locator('.preview-message').evaluate((element) => getComputedStyle(element).fontFamily)
  expect(after).not.toBe(before)

  const toFrom = preview.locator('.preview-to, .preview-from')
  const supportingFont = await toFrom.first().evaluate((element) => getComputedStyle(element).fontFamily)
  expect(await toFrom.last().evaluate((element) => getComputedStyle(element).fontFamily)).toBe(supportingFont)

  const url = await page.getByRole('textbox', { name: 'Share link' }).inputValue()
  await page.goto(url)
  await expect(page.locator('.preview-message')).toHaveClass(/message-font-dancing-script/)
})
