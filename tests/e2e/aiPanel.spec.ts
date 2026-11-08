import { expect, test, type Page, type Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { illustrationBytes, parseSuggestion } from '../../src/ai/aiClient'
import { decodeCardHash } from '../../src/card/codec'

const AI_ORIGIN = 'http://127.0.0.1:4175'
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js**'
const AI_MESSAGE = 'May your coffee be strong and your meetings be short. Here’s to a year of fewer emails and more cake.'

// A stand-in for Cloudflare's Turnstile script: issues a fresh dummy token on
// render and on every reset, and counts calls so tests can check token reuse.
const fakeTurnstileScript = `
  window.__turnstile = { renders: 0, resets: 0, removes: 0 };
  window.turnstile = {
    render(container, options) {
      window.__turnstile.renders++;
      const id = 'widget-' + window.__turnstile.renders;
      window.__turnstileCallbacks = window.__turnstileCallbacks || {};
      window.__turnstileCallbacks[id] = options.callback;
      setTimeout(() => options.callback('token-' + window.__turnstile.renders + '-0'), 10);
      return id;
    },
    reset(id) {
      window.__turnstile.resets++;
      const n = window.__turnstile.resets;
      setTimeout(() => window.__turnstileCallbacks[id]('token-reset-' + n), 10);
    },
    remove() { window.__turnstile.removes++; },
  };
`

type GenerateHandler = (body: Record<string, unknown>, callIndex: number) => { status?: number; json: unknown; delayMs?: number }
type IllustrateHandler = GenerateHandler

async function mockAi(page: Page, options: { status?: unknown; generate?: GenerateHandler; illustrate?: IllustrateHandler } = {}) {
  const generateBodies: Array<Record<string, unknown>> = []
  const illustrateBodies: Array<Record<string, unknown>> = []
  let statusCalls = 0
  await page.route(TURNSTILE_SCRIPT, (route) => route.fulfill({ contentType: 'text/javascript', body: fakeTurnstileScript }))
  await page.route(`${AI_ORIGIN}/v1/status`, (route) => {
    statusCalls++
    return route.fulfill({ json: options.status ?? { enabled: true, signatureRemaining: 3, creativeRemaining: 0 } })
  })
  await page.route(`${AI_ORIGIN}/v1/generate/message`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    generateBodies.push(body)
    const reply = (options.generate ?? (() => ({ json: { message: AI_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' } })))(body, generateBodies.length - 1)
    if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs))
    await route.fulfill({ status: reply.status ?? 200, json: reply.json }).catch(() => {
      // The page may have cancelled the request while it was delayed.
    })
  })
  await page.route(`${AI_ORIGIN}/v1/generate/illustration`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    illustrateBodies.push(body)
    const reply = (options.illustrate ?? (() => ({ json: { error: 'generation_failed' }, status: 502 })))(body, illustrateBodies.length - 1)
    if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs))
    await route.fulfill({ status: reply.status ?? 200, json: reply.json }).catch(() => {})
  })
  return { generateBodies, illustrateBodies, statusCalls: () => statusCalls }
}

async function openPanel(page: Page) {
  await page.getByRole('button', { name: 'Create with AI' }).click()
  const panel = page.getByRole('region', { name: 'Create with AI' })
  await expect(panel).toBeVisible()
  return panel
}

const writeButton = (page: Page) => page.getByRole('button', { name: 'Write my card' })
const message = (page: Page) => page.getByRole('textbox', { name: /Your message/ })

test.describe('Create with AI: client-side response checks', () => {
  test('accepts a suggestion that matches the app’s templates and fonts', () => {
    expect(parseSuggestion({ message: AI_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' }, 'Birthday'))
      .toEqual({ message: AI_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' })
  })

  test('rejects unknown or mismatched templates, unknown fonts, empty or over-long messages', () => {
    const base = { message: AI_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' }
    for (const bad of [
      { ...base, templateId: 'love-letter-01' },
      { ...base, templateId: 'javascript:alert(1)' },
      { ...base, messageFont: 'comic-sans' },
      { ...base, message: '   ' },
      { ...base, message: 'a'.repeat(501) },
      { ...base, source: 'robot' },
      null,
      'not an object',
    ]) {
      expect(parseSuggestion(bad, 'Birthday')).toBeNull()
    }
  })
})

test.describe('Create with AI in the app', () => {
  test('makes no AI or Turnstile requests on page load', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request: Request) => requests.push(request.url()))
    await page.route(TURNSTILE_SCRIPT, (route) => route.fulfill({ contentType: 'text/javascript', body: fakeTurnstileScript }))
    await page.route(`${AI_ORIGIN}/**`, (route) => route.fulfill({ json: {} }))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Create with AI' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(requests.filter((url) => url.startsWith(AI_ORIGIN) || url.includes('challenges.cloudflare.com'))).toEqual([])
  })

  test('fills the existing editor with an editable AI card, sending no names', async ({ page }) => {
    const ai = await mockAi(page)
    await page.goto('/')
    await page.getByRole('textbox', { name: /^To/ }).fill('Priya')
    await page.getByRole('textbox', { name: /^From/ }).fill('Sam')
    const panel = await openPanel(page)
    await expect(panel.getByText('3 AI cards left today')).toBeVisible()
    expect(ai.statusCalls()).toBe(1)

    await panel.getByLabel('Who is it for?').selectOption('colleague')
    await panel.getByLabel('Tone').selectOption('funny')
    await panel.getByLabel('Look').selectOption('whimsical')
    await panel.getByLabel(/Anything to include/).fill('loves coffee')
    await expect(writeButton(page)).toBeEnabled()
    await writeButton(page).click()

    await expect(message(page)).toHaveValue(AI_MESSAGE)
    await expect(page.getByRole('button', { name: 'Choose Party time design' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('option', { name: /Caveat/ })).toHaveAttribute('aria-selected', 'true')
    const preview = page.getByRole('complementary', { name: 'Live card preview' })
    await expect(preview.getByText(AI_MESSAGE)).toBeVisible()
    await expect(preview.getByText('Priya')).toBeVisible()
    await expect(page.getByText('Written with AI help. Edit anything you like.')).toBeVisible()
    await expect(panel.getByRole('form', { name: 'Write a card with AI' }).getByRole('status')).toHaveText('Your card is ready below. Edit anything you like.')
    await expect(panel.getByText('2 AI cards left today')).toBeVisible()

    expect(ai.generateBodies).toHaveLength(1)
    expect(ai.generateBodies[0]).toEqual({
      turnstileToken: 'token-1-0',
      occasion: 'Birthday',
      recipient: 'colleague',
      tone: 'funny',
      style: 'whimsical',
      personalMessage: '',
      extraInstructions: 'loves coffee',
    })
    expect(JSON.stringify(ai.generateBodies[0])).not.toMatch(/Priya|Sam/)

    // Still a normal card: editable, and the share link carries it.
    await message(page).fill(`${AI_MESSAGE} Love from all of us.`)
    await expect.poll(async () => {
      const result = await decodeCardHash(new URL(await page.getByRole('textbox', { name: 'Share link' }).inputValue()).hash)
      return result?.ok ? [result.card.template, result.card.messageFont, result.card.message] : null
    }).toEqual(['birthday-party-01', 'caveat', `${AI_MESSAGE} Love from all of us.`])
  })

  test('switches occasion, design and font when the AI card is for another occasion', async ({ page }) => {
    await mockAi(page, { generate: () => ({ json: { message: AI_MESSAGE, templateId: 'thank-you-sincere-01', messageFont: 'cormorant', source: 'ai' } }) })
    await page.goto('/')
    const panel = await openPanel(page)
    await panel.getByLabel('Occasion').selectOption('Thank you')
    await writeButton(page).click()
    await expect(page.getByRole('button', { name: 'Thank you', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Choose Sincere design' })).toHaveAttribute('aria-pressed', 'true')
    await expect(message(page)).toHaveValue(AI_MESSAGE)
  })

  test('regenerates only the message, keeping the design and font the user chose, with a fresh token each time', async ({ page }) => {
    const second = 'A brand-new message about strong coffee, short meetings and a very good year ahead of you.'
    const ai = await mockAi(page, {
      generate: (_, index) => ({ json: { message: index === 0 ? AI_MESSAGE : second, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' } }),
    })
    await page.goto('/')
    const panel = await openPanel(page)
    await writeButton(page).click()
    await expect(message(page)).toHaveValue(AI_MESSAGE)

    await page.getByRole('button', { name: 'Choose Sunshine design' }).click()
    await page.getByRole('option', { name: /Space Grotesk/ }).click()
    const regenerate = panel.getByRole('button', { name: 'Regenerate message' })
    await expect(regenerate).toBeEnabled()
    await regenerate.click()

    await expect(message(page)).toHaveValue(second)
    await expect(page.getByRole('button', { name: 'Choose Sunshine design' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('option', { name: /Space Grotesk/ })).toHaveAttribute('aria-selected', 'true')
    expect(ai.generateBodies.map(({ turnstileToken }) => turnstileToken)).toEqual(['token-1-0', 'token-reset-1'])
  })

  test('keeps the user’s own words verbatim and labels them as theirs', async ({ page }) => {
    const ownWords = 'Happy birthday, legend! 🎂 Dinner is on me.'
    const ai = await mockAi(page, { generate: (body) => ({ json: { message: body.personalMessage, templateId: 'birthday-sunshine-01', messageFont: 'quicksand', source: 'user' } }) })
    await page.goto('/')
    const panel = await openPanel(page)
    await panel.getByText('Already know what to say?').click()
    await panel.getByLabel(/Your own words/).fill(ownWords)
    await panel.getByRole('button', { name: 'Pick a design for my words' }).click()
    await expect(message(page)).toHaveValue(ownWords)
    expect(ai.generateBodies[0].personalMessage).toBe(ownWords)
    await expect(page.getByText('Written with AI help.')).toHaveCount(0)
    await expect(panel.getByText('3 AI cards left today')).toBeVisible()
  })

  test('warns before replacing a message the user already wrote', async ({ page }) => {
    await mockAi(page)
    await page.goto('/')
    await message(page).fill('My own careful words.')
    const panel = await openPanel(page)
    await expect(panel.getByText('This will replace the message you’ve written below.')).toBeVisible()
  })

  test('renders markup in a returned message as plain text, never as HTML', async ({ page }) => {
    const hostile = 'Happy day! <img src=x onerror="window.__xss=1"> <b>bold</b> and more words here.'
    await mockAi(page, { generate: () => ({ json: { message: hostile, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' } }) })
    await page.goto('/')
    await openPanel(page)
    await writeButton(page).click()
    await expect(message(page)).toHaveValue(hostile)
    const preview = page.getByRole('complementary', { name: 'Live card preview' })
    await expect(preview.getByText(hostile)).toBeVisible()
    await expect(preview.locator('.preview-message img, .preview-message b')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  })

  const failures: Array<[string, { status: number; json: unknown }, RegExp]> = [
    ['the global budget is used up', { status: 503, json: { error: 'budget_exhausted' } }, /resting for today/],
    ['the visitor’s daily limit is reached', { status: 429, json: { error: 'daily_limit_reached' } }, /used today’s AI cards/],
    ['the visitor is in the cooldown', { status: 429, json: { error: 'rate_limited', retryAfterSeconds: 12 } }, /try again in 12 seconds/],
    ['generation fails after the server’s retry', { status: 502, json: { error: 'generation_failed' } }, /couldn’t write a card this time/],
    ['the human check fails', { status: 403, json: { error: 'verification_failed' } }, /confirm you’re human/],
    ['the response doesn’t match the app’s data', { status: 200, json: { message: AI_MESSAGE, templateId: 'love-letter-01', messageFont: 'caveat', source: 'ai' } }, /couldn’t write a card this time/],
  ]
  for (const [label, reply, expected] of failures) {
    test(`explains, changes nothing and keeps the editor working when ${label}`, async ({ page }) => {
      const ai = await mockAi(page, { generate: () => reply })
      await page.goto('/')
      await message(page).fill('Typed before trying AI.')
      const panel = await openPanel(page)
      await writeButton(page).click()
      await expect(panel.getByRole('form', { name: 'Write a card with AI' }).getByRole('status')).toHaveText(expected)
      expect(ai.generateBodies).toHaveLength(1)
      await expect(message(page)).toHaveValue('Typed before trying AI.')
      await message(page).fill('Still works without AI.')
      await expect(page.getByRole('complementary', { name: 'Live card preview' }).getByText('Still works without AI.')).toBeVisible()
    })
  }

  test('disables generation once the daily limit is reached', async ({ page }) => {
    await mockAi(page, { generate: () => ({ status: 429, json: { error: 'daily_limit_reached' } }) })
    await page.goto('/')
    const panel = await openPanel(page)
    await writeButton(page).click()
    await expect(writeButton(page)).toBeDisabled()
    await expect(panel.getByText('0 AI cards left today')).toBeVisible()
  })

  test('explains when the helper is off and never asks for a generation', async ({ page }) => {
    const ai = await mockAi(page, { status: { enabled: false, signatureRemaining: 0, creativeRemaining: 0 } })
    await page.goto('/')
    const panel = await openPanel(page)
    await expect(panel.getByRole('form', { name: 'Write a card with AI' }).getByRole('status')).toHaveText(/isn’t available right now/)
    await expect(writeButton(page)).toBeDisabled()
    expect(ai.generateBodies).toHaveLength(0)
  })

  test('reports a network failure without retrying from the browser', async ({ page }) => {
    let calls = 0
    await mockAi(page)
    await page.route(`${AI_ORIGIN}/v1/generate/message`, (route) => { calls++; return route.abort() })
    await page.goto('/')
    const panel = await openPanel(page)
    await writeButton(page).click()
    await expect(panel.getByRole('form', { name: 'Write a card with AI' }).getByRole('status')).toHaveText(/couldn’t reach the AI helper/)
    await page.waitForTimeout(300) // Give any (unwanted) automatic retry a chance to show up.
    expect(calls).toBe(1)
  })

  test('can be cancelled while writing, leaving the card unchanged', async ({ page }) => {
    await mockAi(page, { generate: () => ({ json: { message: AI_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' }, delayMs: 3000 }) })
    await page.goto('/')
    await message(page).fill('Keep me.')
    const panel = await openPanel(page)
    await writeButton(page).click()
    await expect(panel).toHaveAttribute('aria-busy', 'true')
    await expect(panel.getByRole('form', { name: 'Write a card with AI' }).getByRole('status')).toHaveText('Writing your card…')
    await panel.getByRole('button', { name: 'Cancel' }).click()
    await expect(panel.getByRole('form', { name: 'Write a card with AI' }).getByRole('status')).toHaveText('Cancelled. Nothing was changed.')
    await expect(message(page)).toHaveValue('Keep me.')
  })

  test('works offline as a normal card maker, with the helper explaining it needs a connection', async ({ page, context }) => {
    const ai = await mockAi(page)
    await page.goto('/')
    await context.setOffline(true)
    const panel = await openPanel(page)
    await expect(panel.getByRole('form', { name: 'Write a card with AI' }).getByRole('status')).toHaveText(/You’re offline/)
    await expect(writeButton(page)).toBeDisabled()
    expect(ai.statusCalls()).toBe(0)
    await message(page).fill('Offline card.')
    await expect(page.getByRole('complementary', { name: 'Live card preview' }).getByText('Offline card.')).toBeVisible()
    await context.setOffline(false)
  })

  test('closes, removes the Turnstile widget and can be reopened', async ({ page }) => {
    await mockAi(page)
    await page.goto('/')
    const panel = await openPanel(page)
    await expect(writeButton(page)).toBeEnabled()
    await panel.getByRole('button', { name: 'Close Create with AI' }).click()
    await expect(panel).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __turnstile: { removes: number } }).__turnstile.removes)).toBe(1)
    await openPanel(page)
    await expect(writeButton(page)).toBeEnabled()
  })

  test('downloads an AI-written card through the existing exporter', async ({ page }) => {
    await mockAi(page)
    await page.goto('/')
    await openPanel(page)
    await writeButton(page).click()
    await expect(message(page)).toHaveValue(AI_MESSAGE)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    expect((await download).suggestedFilename()).toBe('little-hello-birthday-party-01.png')
  })

  test('fits a 360px phone screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await mockAi(page)
    await page.goto('/')
    const panel = await openPanel(page)
    await panel.getByText('Already know what to say?').click()
    await expect(writeButton(page)).toBeEnabled()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const box = await writeButton(page).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })
})

/** Paints a real, decodable 1024x1024 JPEG in the browser: bright blue with a white sun, so pixels can be checked later. */
async function makeJpegBase64(page: Page): Promise<string> {
  await page.goto('about:blank')
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const context = canvas.getContext('2d')!
    context.fillStyle = '#1f5fd6'
    context.fillRect(0, 0, 1024, 1024)
    context.fillStyle = '#ffffff'
    context.beginPath()
    context.arc(512, 512, 120, 0, Math.PI * 2)
    context.fill()
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
  })
}

const STATUS_WITH_ILLUSTRATION = { enabled: true, signatureRemaining: 3, creativeRemaining: 1 }
const illustrationReply = (image: string) => () => ({ json: { image, mimeType: 'image/jpeg', width: 1024, height: 1024 } })
const createIllustration = (page: Page) => page.getByRole('button', { name: 'Create an illustration' })
const preview = (page: Page) => page.getByRole('complementary', { name: 'Live card preview' })

test.describe('Create with AI: illustration checks in the browser', () => {
  const jpegLike = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7), Buffer.from([0xff, 0xd9])]).toString('base64')

  test('accepts only complete base64 JPEG data labelled as image/jpeg', () => {
    expect(illustrationBytes({ image: jpegLike, mimeType: 'image/jpeg' })?.length).toBe(2006)
    for (const bad of [
      { image: jpegLike, mimeType: 'image/svg+xml' },
      { image: Buffer.from('<svg onload="alert(1)"/>').toString('base64'), mimeType: 'image/jpeg' },
      { image: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(100)]).toString('base64'), mimeType: 'image/jpeg' },
      { image: jpegLike.slice(0, -8), mimeType: 'image/jpeg' },
      { image: 'https://example.com/cat.jpg', mimeType: 'image/jpeg' },
      { image: 'A'.repeat(3_000_000), mimeType: 'image/jpeg' },
      { mimeType: 'image/jpeg' },
      null,
    ]) {
      expect(illustrationBytes(bad)).toBeNull()
    }
  })
})

test.describe('Create with AI: original illustrations', () => {
  test('adds an AI illustration in the illustration-above-text layout, labelled, while share links keep the template', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-write'])
    const image = await makeJpegBase64(page)
    const ai = await mockAi(page, { status: STATUS_WITH_ILLUSTRATION, illustrate: illustrationReply(image) })
    await page.goto('/')
    const panel = await openPanel(page)
    await expect(panel.getByText('1 illustration left today')).toBeVisible()
    await panel.getByLabel('Look').selectOption('whimsical')
    await expect(createIllustration(page)).toBeEnabled()
    await createIllustration(page).click()

    const card = preview(page).locator('.card-preview')
    await expect(card).toHaveClass(/card-layout-ai-top/)
    await expect(card.locator('image.source-ai')).toHaveAttribute('href', /^blob:/)
    await expect(preview(page).getByText('AI-generated illustration. Share links show the Little Hello design.')).toBeVisible()
    await expect(panel.getByText('Your illustration is on the card. Download the card to keep it.')).toBeVisible()
    await expect(panel.getByText('0 illustrations left today')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Make a new illustration' })).toBeDisabled()
    expect(ai.illustrateBodies).toEqual([{ turnstileToken: 'token-1-0', occasion: 'Birthday', style: 'whimsical' }])

    await message(page).fill('Happy birthday!')
    await page.getByRole('button', { name: 'Copy Link' }).click()
    await expect(page.getByText('Link copied! It shows the Little Hello design. Download the card to keep the AI illustration.')).toBeVisible()
    const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue()
    const decoded = await decodeCardHash(new URL(link).hash)
    expect(decoded?.ok && decoded.card.template).toBe('birthday-confetti-01')
    expect(link).not.toContain('blob:')
  })

  test('switches between the AI illustration and the Little Hello design, and drops it for a new occasion', async ({ page }) => {
    const image = await makeJpegBase64(page)
    await mockAi(page, { status: STATUS_WITH_ILLUSTRATION, illustrate: illustrationReply(image) })
    await page.goto('/')
    await openPanel(page)
    await createIllustration(page).click()
    const card = preview(page).locator('.card-preview')
    await expect(card).toHaveClass(/card-layout-ai-top/)

    await page.getByRole('button', { name: 'Use the Little Hello design' }).click()
    await expect(card).not.toHaveClass(/card-layout-ai-top/)
    await page.getByRole('button', { name: 'Use my AI illustration' }).click()
    await expect(card).toHaveClass(/card-layout-ai-top/)

    await page.getByRole('button', { name: 'Choose Sunshine design' }).click()
    await expect(card).not.toHaveClass(/card-layout-ai-top/)
    await expect(page.getByRole('button', { name: 'Use my AI illustration' })).toBeVisible()

    await page.getByRole('button', { name: 'Love', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Use my AI illustration' })).toHaveCount(0)
  })

  test('downloads the card with the AI illustration on top and the words on the panel below', async ({ page }) => {
    const image = await makeJpegBase64(page)
    await mockAi(page, { status: STATUS_WITH_ILLUSTRATION, illustrate: illustrationReply(image) })
    await page.goto('/')
    await openPanel(page)
    await createIllustration(page).click()
    await expect(preview(page).locator('.card-layout-ai-top')).toBeVisible()
    await message(page).fill('Happy birthday! Hope your day is wonderful.')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('little-hello-birthday-confetti-01-ai.png')
    const pngBase64 = readFileSync((await download.path())!).toString('base64')
    const pixels = await page.evaluate(async (dataUrl) => {
      const img = new Image()
      img.src = dataUrl
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(img, 0, 0)
      const at = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3))
      return { size: [img.naturalWidth, img.naturalHeight], top: at(100, 120), panel: at(30, 1340) }
    }, `data:image/png;base64,${pngBase64}`)
    expect(pixels.size).toEqual([1080, 1350])
    // Top of the card is the (blue) illustration; the bottom margin is the template's cream panel (#F6F0E4).
    expect(pixels.top[2]).toBeGreaterThan(150)
    expect(pixels.top[0]).toBeLessThan(80)
    expect(pixels.panel).toEqual([0xf6, 0xf0, 0xe4])
  })

  test('explains when today’s illustration is used up or an image fails, leaving the card as it was', async ({ page }) => {
    const pngNotJpeg = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(40_000, 3)]).toString('base64')
    const replies = [
      { status: 429, json: { error: 'daily_limit_reached' } },
      { status: 503, json: { error: 'budget_exhausted' } },
      { status: 200, json: { image: pngNotJpeg, mimeType: 'image/jpeg', width: 1024, height: 1024 } },
    ]
    const expected = [/made today’s AI illustration/, /resting for today/, /couldn’t write a card this time/]
    for (let index = 0; index < replies.length; index++) {
      await mockAi(page, { status: STATUS_WITH_ILLUSTRATION, illustrate: () => replies[index] })
      await page.goto('/')
      const panel = await openPanel(page)
      await createIllustration(page).click()
      await expect(panel.locator('.ai-illustration').getByRole('status')).toHaveText(expected[index])
      await expect(preview(page).locator('.card-layout-ai-top')).toHaveCount(0)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
    }
  })

  test('is unavailable when the visitor has no illustrations left, without blocking text cards', async ({ page }) => {
    await mockAi(page, { status: { enabled: true, signatureRemaining: 2, creativeRemaining: 0 } })
    await page.goto('/')
    const panel = await openPanel(page)
    await expect(panel.getByText('0 illustrations left today')).toBeVisible()
    await expect(createIllustration(page)).toBeDisabled()
    await expect(writeButton(page)).toBeEnabled()
  })

  test('keeps the illustration when a new message is written for the same occasion', async ({ page }) => {
    const image = await makeJpegBase64(page)
    await mockAi(page, { status: STATUS_WITH_ILLUSTRATION, illustrate: illustrationReply(image) })
    await page.goto('/')
    await openPanel(page)
    await createIllustration(page).click()
    await expect(preview(page).locator('.card-layout-ai-top')).toBeVisible()
    await writeButton(page).click()
    await expect(message(page)).toHaveValue(AI_MESSAGE)
    // The AI design pick changes the template, which shows that design; the illustration is one click away.
    await expect(page.getByRole('button', { name: /Use my AI illustration|Use the Little Hello design/ })).toBeVisible()
  })

  for (const viewport of [{ width: 320, height: 720 }, { width: 360, height: 800 }, { width: 768, height: 1000 }, { width: 1280, height: 900 }]) {
    test(`fits short, long and 500-character messages in every font without clipping or overlap at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      const image = await makeJpegBase64(page)
      await mockAi(page, { status: STATUS_WITH_ILLUSTRATION, illustrate: illustrationReply(image) })
      await page.goto('/')
      await openPanel(page)
      await createIllustration(page).click()
      await page.getByRole('button', { name: 'Close Create with AI' }).click()
      await page.getByRole('textbox', { name: /^To/ }).fill('Alexandria Montgomery-Smith')
      await page.getByRole('textbox', { name: /^From/ }).fill('Everyone at the office')
      const words = 'Wishing you a wonderful birthday filled with laughter, kindness and all of your favourite things. '.repeat(6)
      const fontOptions = page.locator('.font-option')
      const fontCount = await fontOptions.count()
      // Each length sits at the top of one of the renderer's size steps (normal ≤120, long ≤200, xlong ≤500).
      for (const length of [120, 200, 500]) {
      await message(page).fill(words.slice(0, length).trim())
      for (let index = 0; index < fontCount; index++) {
        await fontOptions.nth(index).click()
        const geometry = await preview(page).locator('.card-layout-ai-top').evaluate(async (card) => {
          await document.fonts.ready
          const box = (selector: string) => card.querySelector(selector)!.getBoundingClientRect()
          const cardBox = card.getBoundingClientRect()
          const panel = box('.preview-content')
          const messageBox = box('.preview-message')
          const from = box('.preview-from')
          const fontSize = parseFloat(getComputedStyle(card.querySelector('.preview-message')!).fontSize)
          return { cardBottom: cardBox.bottom, panelTop: panel.top, messageTop: messageBox.top, messageBottom: messageBox.bottom, fromTop: from.top, fromBottom: from.bottom, fontSize }
        })
        const font = `${await fontOptions.nth(index).locator('.font-option-name').innerText()} (${length} chars)`
        expect(geometry.messageTop, `${font}: message starts inside the panel`).toBeGreaterThanOrEqual(geometry.panelTop)
        expect(geometry.messageBottom, `${font}: message ends above the sender`).toBeLessThanOrEqual(geometry.fromTop + 0.5)
        expect(geometry.fromBottom, `${font}: sender stays on the card`).toBeLessThanOrEqual(geometry.cardBottom + 0.5)
        expect(geometry.fontSize, `${font}: message stays readable`).toBeGreaterThanOrEqual(10)
      }
      }
    })
  }
})
