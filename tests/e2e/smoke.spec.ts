import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

async function samplePngPixel(page: import('@playwright/test').Page, pngPath: string, x: number, y: number) {
  const base64 = readFileSync(pngPath).toString('base64')
  return page.evaluate(
    async ({ dataUrl, x, y }) => {
      const image = new Image()
      image.src = dataUrl
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('failed to decode downloaded PNG'))
      })
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return Array.from(context.getImageData(x, y, 1, 1).data)
    },
    { dataUrl: `data:image/png;base64,${base64}`, x, y },
  )
}

const messageFontFamilies = [
  'Caveat',
  'Dancing Script',
  'Cormorant Garamond',
  'DM Serif Display',
  'Libre Baskerville',
  'Quicksand',
  'Satisfy',
  'Space Grotesk',
]

test('has no horizontal overflow on a narrow Android viewport', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Make someone’s day.' })).toBeVisible()

  await page.getByRole('button', { name: 'Love' }).click()
  await page.getByRole('button', { name: 'Choose Love letter design' }).click()
  await page.getByRole('textbox', { name: /Your message/ }).fill('Every day with you feels like a page from a favorite story.')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await context.close()
  expect(overflow, `page overflowed horizontally by ${overflow}px at a 360px viewport width`).toBeLessThanOrEqual(0)
})

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

test('downloaded PNG renders the full-bleed artwork at full fidelity, not a blurred low-res decode', async ({ page }) => {
  const samplePoint = { x: 1020, y: 1300 }

  await page.goto('/')

  const expectedPixel = await page.evaluate(
    async ({ x, y }) => {
      const width = 1080
      const height = 1350
      const response = await fetch(`${location.origin}/artwork/celebration-cake-ribbon.jpg`)
      const bitmap = await createImageBitmap(await response.blob())
      const scale = Math.max(width / bitmap.width, height / bitmap.height)
      const drawWidth = bitmap.width * scale
      const drawHeight = bitmap.height * scale
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')!
      context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
      return Array.from(context.getImageData(x, y, 1, 1).data)
    },
    samplePoint,
  )

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Card' }).click()
  const download = await downloadPromise
  const downloadedPixel = await samplePngPixel(page, (await download.path())!, samplePoint.x, samplePoint.y)

  const [r1, g1, b1] = expectedPixel
  const [r2, g2, b2] = downloadedPixel
  const distance = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
  expect(distance, `expected downloaded artwork pixel to match the source image: source rgb(${r1},${g1},${b1}) vs downloaded rgb(${r2},${g2},${b2})`).toBeLessThan(12)
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

test('registers every expressive message font as an actual @font-face, not just a name in CSS', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  const registeredFamilies = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replaceAll('"', '')),
  )

  messageFontFamilies.forEach((family) => {
    expect(registeredFamilies, `expected "${family}" to be registered as a loaded @font-face`).toContain(family)
  })
})
