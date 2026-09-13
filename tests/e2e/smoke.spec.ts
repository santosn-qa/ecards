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

async function getDownloadedTextBounds(page: import('@playwright/test').Page, pngPath: string, region: { x: number; y: number; width: number; height: number }) {
  const base64 = readFileSync(pngPath).toString('base64')
  return page.evaluate(
    async ({ dataUrl, region }) => {
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
      const pixels = context.getImageData(region.x, region.y, region.width, region.height).data

      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      for (let y = 0; y < region.height; y += 1) {
        for (let x = 0; x < region.width; x += 1) {
          const index = (y * region.width + x) * 4
          const [red, green, blue, alpha] = pixels.slice(index, index + 4)
          if (alpha > 240 && red < 170 && green < 150 && blue < 130) {
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
      }

      if (!Number.isFinite(minX)) throw new Error('no text-colored pixels found in downloaded PNG region')
      return { x: region.x + minX, y: region.y + minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    },
    { dataUrl: `data:image/png;base64,${base64}`, region },
  )
}

async function getCanvasTextBounds(page: import('@playwright/test').Page, options: { text: string; font: string; baselineY: number; tracking?: number }) {
  return page.evaluate(({ text, font, baselineY, tracking = 0 }) => {
    const canvas = document.createElement('canvas')
    canvas.width = 760
    canvas.height = 180
    const context = canvas.getContext('2d')!
    context.font = font
    context.textBaseline = 'alphabetic'
    context.fillStyle = '#4a3b32'

    let cursorX = 40
    for (const character of text) {
      context.fillText(character, cursorX, baselineY)
      cursorX += context.measureText(character).width + tracking
    }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 0) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }

    if (!Number.isFinite(minX)) throw new Error('no reference text pixels were drawn')
    return { width: maxX - minX + 1, height: maxY - minY + 1 }
  }, options)
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

test('has a branded title and share-preview metadata instead of the generic placeholder', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Little Hello — send a little hello')

  const metaContent = (name: string) => page.locator(`head meta[name="${name}"], head meta[property="${name}"]`).getAttribute('content')
  await expect(await metaContent('description')).toMatch(/little hello/i)
  await expect(await metaContent('og:title')).toBe('Little Hello')
  await expect(await metaContent('og:description')).toMatch(/card/i)
  await expect(await metaContent('og:image')).toBeTruthy()
  await expect(await metaContent('twitter:card')).toBe('summary_large_image')
})

function relativeLuminance([r, g, b]: number[]) {
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function contrastRatio(a: number[], b: number[]) {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

async function rgbOf(locator: import('@playwright/test').Locator, property: 'color' | 'backgroundColor' = 'color') {
  const value = await locator.evaluate((element, prop) => getComputedStyle(element)[prop as 'color'], property)
  const match = value.match(/[\d.]+/g)
  if (!match) throw new Error(`could not parse color: ${value}`)
  return match.slice(0, 3).map(Number)
}

test('secondary text and the primary Share Card button meet WCAG AA contrast against their background', async ({ page }) => {
  await page.goto('/')

  const bodyBackground = await rgbOf(page.locator('html'), 'backgroundColor')

  const sectionHint = page.getByText('Pick one to get started')
  await expect(contrastRatio(await rgbOf(sectionHint), bodyBackground)).toBeGreaterThanOrEqual(4.5)

  const shareButton = page.getByRole('button', { name: 'Share Card' })
  const buttonBackground = await rgbOf(shareButton, 'backgroundColor')
  const buttonText = await rgbOf(shareButton)
  expect(contrastRatio(buttonText, buttonBackground)).toBeGreaterThanOrEqual(4.5)
})

test('keeps the "Made privately" trust message visible and readable on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('/')

  const privacyNote = page.locator('.privacy-note')
  await expect(privacyNote).toBeVisible()
  const { fontSize, text } = await privacyNote.evaluate((element) => ({
    fontSize: parseFloat(getComputedStyle(element).fontSize),
    text: element.textContent?.trim() ?? '',
  }))
  await context.close()
  expect(fontSize).toBeGreaterThan(0)
  expect(text.length).toBeGreaterThan(1)
})

test('shows the full "Made privately on your device" trust message on desktop', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Made privately on your device')).toBeVisible()
})

test('on mobile, shows the live preview after the message step instead of before the design step', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('/')

  const designHeading = page.getByRole('heading', { name: 'Choose a design' })
  const messageHeading = page.getByRole('heading', { name: 'Write your message' })
  const preview = page.getByRole('complementary', { name: 'Live card preview' })

  const [designBox, messageBox, previewBox] = await Promise.all([
    designHeading.boundingBox(),
    messageHeading.boundingBox(),
    preview.boundingBox(),
  ])

  await context.close()
  expect(designBox!.y, 'design step should appear above the live preview on mobile').toBeLessThan(previewBox!.y)
  expect(messageBox!.y, 'message step should appear above the live preview on mobile').toBeLessThan(previewBox!.y)
})

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

test('shows a character counter for the To and From fields', async ({ page }) => {
  await page.goto('/')

  const toField = page.getByRole('textbox', { name: 'To optional' })
  const fromField = page.getByRole('textbox', { name: 'From optional' })

  await expect(page.getByText('0/60').first()).toBeVisible()
  await toField.fill('Grandma')
  await expect(page.getByText('7/60')).toBeVisible()
  await fromField.fill('Nouri')
  await expect(page.getByText('5/60')).toBeVisible()
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

test('fills the message from a sample chip, scoped to the selected occasion', async ({ page }) => {
  await page.goto('/')

  const preview = page.getByRole('complementary', { name: 'Live card preview' })
  const messageField = page.getByRole('textbox', { name: /Your message/ })

  await page.getByRole('button', { name: 'Heartfelt' }).click()
  await expect(messageField).toHaveValue(/Wishing you a birthday/)
  await expect(preview).toContainText('Wishing you a birthday')

  await expect(page.getByRole('button', { name: 'Formal' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Thank you' }).click()
  await expect(page.getByRole('button', { name: 'Formal' })).toBeVisible()

  await messageField.fill('typed text should be protected')
  await page.getByRole('button', { name: 'Short & sweet' }).click()
  await expect(messageField).toHaveValue('typed text should be protected')
  await expect(page.getByRole('status')).toContainText(/replace/i)

  await page.getByRole('button', { name: 'Short & sweet' }).click()
  await expect(messageField).toHaveValue('Just a little note to say... thank you. Truly.')
})

test('does not warn when browsing between sample chips with no typed draft to lose', async ({ page }) => {
  await page.goto('/')

  const messageField = page.getByRole('textbox', { name: /Your message/ })

  await page.getByRole('button', { name: 'Heartfelt' }).click()
  await expect(messageField).toHaveValue(/Wishing you a birthday/)

  await page.getByRole('button', { name: 'Short & sweet' }).click()
  await expect(messageField).toHaveValue('Happy birthday! Hope your day is full of cake, laughter, and everything you love.')
  await expect(page.getByRole('status')).not.toContainText(/replace/i)
})

test('clears the message when switching occasion, and offers a clear button while there is text', async ({ page }) => {
  await page.goto('/')

  const messageField = page.getByRole('textbox', { name: /Your message/ })
  const clearButton = page.getByRole('button', { name: 'Clear' })

  await expect(clearButton).toHaveCount(0)
  await messageField.fill('A note for Birthday')
  await expect(clearButton).toBeVisible()

  await page.getByRole('button', { name: 'Love' }).click()
  await expect(messageField).toHaveValue('')
  await expect(clearButton).toHaveCount(0)

  await messageField.fill('A note for Love')
  await clearButton.click()
  await expect(messageField).toHaveValue('')
  await expect(clearButton).toHaveCount(0)
})

test('resets scroll position to the top when navigating to the how-to guide', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.scrollTo(0, 800))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'How to guide' }).click()
  await expect(page).toHaveURL(/#\/guide$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('links from the landing page to the how-to guide', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'How to guide' }).click()
  await expect(page).toHaveURL(/#\/guide$/)
  await expect(page.getByRole('heading', { name: 'Send a Little Hello in minutes.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Back to Little Hello →' })).toHaveAttribute('href', '#/')

  await page.getByRole('link', { name: 'Start Making a Card' }).click()
  await expect(page.getByRole('heading', { name: 'Make someone’s day.' })).toBeVisible()
})

test('does not duplicate the raw share URL as visible status text below the share link field', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: /Your message/ }).fill('Happy birthday!')

  const shareLink = page.getByRole('textbox', { name: 'Share link' })
  await expect(shareLink).toHaveValue(/#\/card\/v2\//)

  await expect(page.getByRole('status')).toHaveText('')
})

test('generates a share URL and opens the shared card view', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Choose Sunshine design' }).click()
  await page.getByRole('textbox', { name: 'To optional' }).fill('Mom')
  await page.getByRole('textbox', { name: /Your message/ }).fill('Happy birthday!')
  await page.getByRole('textbox', { name: 'From optional' }).fill('Nouri')

  const shareLink = page.getByRole('textbox', { name: 'Share link' })
  await expect(shareLink).toHaveValue(/#\/card\/v2\//)
  const url = await shareLink.inputValue()

  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Mom, this is for you.' })).toBeVisible()
  await expect(page.getByRole('article')).toContainText('Happy birthday!')
  await expect(page.getByRole('link', { name: 'Create Your Own Card' })).toBeVisible()
})

test('warns before copying or sharing a card with an empty message, and proceeds on confirmation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-write'])
  await page.goto('/')

  await page.getByRole('button', { name: 'Copy Link' }).click()
  await expect(page.getByRole('status')).toContainText(/message is empty/i)
  const clipboardAfterFirstClick = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))
  expect(clipboardAfterFirstClick).toBe('')

  await page.getByRole('button', { name: 'Copy Link' }).click()
  await expect(page.getByRole('status')).toHaveText('Link copied!')
})

test('does not warn about an empty message once one has been written', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-write'])
  await page.goto('/')
  await page.getByRole('textbox', { name: /Your message/ }).fill('A card worth keeping.')

  await page.getByRole('button', { name: 'Copy Link' }).click()
  await expect(page.getByRole('status')).toHaveText('Link copied!')
})

test('warns before downloading a card with an empty message, and proceeds on confirmation', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Download Card' }).click()
  await expect(page.getByRole('status')).toContainText(/message is empty/i)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Card' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/little-hello-birthday-confetti-01\.png/)
})

test('still opens a card shared with the old (pre-compact) link format', async ({ page }) => {
  const legacyPayload = btoa(JSON.stringify({
    v: 1,
    template: 'birthday-sunshine-01',
    to: 'Mom',
    message: 'Happy birthday!',
    from: 'Nouri',
  }))
  await page.goto(`/#/card/${legacyPayload}`)
  await expect(page.getByRole('heading', { name: 'Mom, this is for you.' })).toBeVisible()
  await expect(page.getByRole('article')).toContainText('Happy birthday!')
})

test('handles malformed shared URLs without crashing', async ({ page }) => {
  await page.goto('/#/card/not-a-valid-card')
  await expect(page.getByRole('heading', { name: 'We couldn’t open this card.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Your Own Card' })).toBeVisible()
})

test('handles malformed v2 shared URLs without crashing', async ({ page }) => {
  await page.goto('/#/card/v2/not-a-valid-payload')
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

  await page.getByRole('button', { name: 'Download Card' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Card' }).click()
  const download = await downloadPromise
  const downloadedPixel = await samplePngPixel(page, (await download.path())!, samplePoint.x, samplePoint.y)

  const [r1, g1, b1] = expectedPixel
  const [r2, g2, b2] = downloadedPixel
  const distance = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
  expect(distance, `expected downloaded artwork pixel to match the source image: source rgb(${r1},${g1},${b1}) vs downloaded rgb(${r2},${g2},${b2})`).toBeLessThan(12)
})

test('downloaded PNG matches the live preview typography for the card text', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'To optional' }).fill('Babe')
  await page.getByRole('textbox', { name: /Your message/ }).fill('You are amazing')
  await page.evaluate(() => document.fonts.ready)

  const previewMessageFont = await page.locator('.preview-message').evaluate((element) => getComputedStyle(element).fontFamily)
  expect(previewMessageFont).toContain('Caveat')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Card' }).click()
  const download = await downloadPromise
  const pngPath = (await download.path())!

  const messageBounds = await getDownloadedTextBounds(page, pngPath, { x: 70, y: 260, width: 520, height: 100 })
  const expectedMessageBounds = await getCanvasTextBounds(page, {
    text: 'You are amazing',
    font: `400 44px ${previewMessageFont}`,
    baselineY: 80,
  })
  expect(Math.abs(messageBounds.width - expectedMessageBounds.width), `downloaded message width ${messageBounds.width}px should match the live Caveat font width ${expectedMessageBounds.width}px`).toBeLessThanOrEqual(22)
  expect(Math.abs(messageBounds.height - expectedMessageBounds.height), `downloaded message height ${messageBounds.height}px should match the live Caveat font height ${expectedMessageBounds.height}px`).toBeLessThanOrEqual(12)

  const taglineBounds = await getDownloadedTextBounds(page, pngPath, { x: 70, y: 120, width: 520, height: 48 })
  const expectedTaglineBounds = await getCanvasTextBounds(page, {
    text: 'MAKE A LITTLE NOISE',
    font: '400 22px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    baselineY: 38,
    tracking: 22 * 0.12,
  })
  expect(Math.abs(taglineBounds.width - expectedTaglineBounds.width), `downloaded tagline width ${taglineBounds.width}px should match the live uppercase tracked width ${expectedTaglineBounds.width}px`).toBeLessThanOrEqual(28)
})

test('live preview does not auto-hyphenate the placeholder message at narrow card widths', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 985, height: 710 } })
  const page = await context.newPage()
  await page.goto('/')

  const previewMessage = page.locator('.preview-message')
  await expect(previewMessage).toHaveText('Your message will appear here.')
  await expect(previewMessage).toHaveCSS('hyphens', 'none')

  await page.getByRole('button', { name: 'Download Card' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Card' }).click()
  const download = await downloadPromise
  const messageBounds = await getDownloadedTextBounds(page, (await download.path())!, { x: 70, y: 260, width: 520, height: 120 })
  const expectedMessageBounds = await getCanvasTextBounds(page, {
    text: 'Your message will',
    font: '400 44px "Caveat", "Segoe Print", cursive',
    baselineY: 80,
  })

  expect(messageBounds.width, 'downloaded placeholder should wrap at word boundaries instead of drawing "ap-pear"').toBeGreaterThanOrEqual(expectedMessageBounds.width - 24)
  await context.close()
})

test('lets desktop users step through the font carousel with chevron buttons', async ({ page }) => {
  await page.goto('/')

  const fontOptions = page.locator('.font-options')
  const initialScrollLeft = await fontOptions.evaluate((element) => element.scrollLeft)

  await page.getByRole('button', { name: 'Show more font styles' }).click()
  await expect.poll(() => fontOptions.evaluate((element) => element.scrollLeft)).toBeGreaterThan(initialScrollLeft)
  const afterForward = await fontOptions.evaluate((element) => element.scrollLeft)

  await page.getByRole('button', { name: 'Show previous font styles' }).click()
  await expect.poll(() => fontOptions.evaluate((element) => element.scrollLeft)).toBeLessThan(afterForward)
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

  const shareLink = page.getByRole('textbox', { name: 'Share link' })
  await expect(shareLink).toHaveValue(/#\/card\/v2\//)
  const url = await shareLink.inputValue()
  await page.goto(url)
  await expect(page.locator('.preview-message')).toHaveClass(/message-font-dancing-script/)
})

test('design thumbnail placeholder matches the artwork tone instead of flashing a mismatched color while the image loads', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Congratulations' }).click()

  const thumbnail = page.locator('.template-art').first()
  const backgroundColor = await thumbnail.evaluate((element) => getComputedStyle(element).backgroundColor)

  // congratulations-bright-01's artwork.backgroundColor (#FAF1E6, a warm cream matching the illustration).
  expect(backgroundColor, 'thumbnail placeholder should match the cream-toned artwork, not a leftover mismatched color').toBe('rgb(250, 241, 230)')
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
