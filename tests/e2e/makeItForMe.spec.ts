import { expect, test, type Page, type Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { illustrationBytes, parseSuggestion, toneForRecipient } from '../../src/ai/aiClient'
import { decodeCardHash } from '../../src/card/codec'
import { cardTemplates } from '../../src/data/templates'

const AI_ORIGIN = 'http://127.0.0.1:4175'
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js**'
const AI_MESSAGE = 'May your day be full of sunshine and the people you love most. Here’s to a wonderful year ahead.'
const SECOND_MESSAGE = 'A brand-new message about cake, laughter and a very good year ahead of you, from all of us.'

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
      setTimeout(() => window.__turnstileCallbacks[id] && window.__turnstileCallbacks[id]('token-reset-' + n), 10);
    },
    remove(id) { window.__turnstile.removes++; delete window.__turnstileCallbacks[id]; },
  };
`

type Reply = { status?: number; json: unknown; delayMs?: number }
type Handler = (body: Record<string, unknown>, callIndex: number) => Reply

/** Replies like the real Worker: a design that belongs to the requested occasion (Birthday → Party time). */
const templateFor = (occasion: unknown) => (occasion === 'Birthday' || !occasion ? 'birthday-party-01' : cardTemplates.find((template) => template.occasion === occasion)!.id)
const defaultMessage: Handler = (body) => ({ json: { message: AI_MESSAGE, templateId: templateFor(body.occasion), messageFont: 'caveat', source: 'ai' } })
const noPicture: Handler = () => ({ status: 502, json: { error: 'generation_failed' } })

async function mockAi(page: Page, options: { status?: unknown; generate?: Handler; illustrate?: Handler } = {}) {
  const generateBodies: Array<Record<string, unknown>> = []
  const illustrateBodies: Array<Record<string, unknown>> = []
  let statusCalls = 0
  await page.route(TURNSTILE_SCRIPT, (route) => route.fulfill({ contentType: 'text/javascript', body: fakeTurnstileScript }))
  await page.route(`${AI_ORIGIN}/v1/status`, (route) => {
    statusCalls++
    return route.fulfill({ json: options.status ?? { enabled: true, signatureRemaining: 3, creativeRemaining: 0 } })
  })
  const respond = (bodies: Array<Record<string, unknown>>, handler: Handler) => async (route: import('@playwright/test').Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    bodies.push(body)
    const reply = handler(body, bodies.length - 1)
    if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs))
    await route.fulfill({ status: reply.status ?? 200, json: reply.json }).catch(() => {
      // The page may have stopped the request while it was delayed.
    })
  }
  await page.route(`${AI_ORIGIN}/v1/generate/message`, respond(generateBodies, options.generate ?? defaultMessage))
  await page.route(`${AI_ORIGIN}/v1/generate/illustration`, respond(illustrateBodies, options.illustrate ?? noPicture))
  return { generateBodies, illustrateBodies, statusCalls: () => statusCalls }
}

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

const pictureReply = (image: string): Handler => () => ({ json: { image, mimeType: 'image/jpeg', width: 1024, height: 1024 } })
const WITH_PICTURE = { enabled: true, signatureRemaining: 3, creativeRemaining: 1 }

const message = (page: Page) => page.getByRole('textbox', { name: /Your message/ })
const preview = (page: Page) => page.getByRole('complementary', { name: 'Live card preview' })
const aiStatus = (page: Page) => page.locator('.make-for-me').getByRole('status')
const makeItForMe = (page: Page) => page.getByRole('button', { name: /Make it for me/ })

/** Steps 1–3: pick who and what, then "Make it for me", which starts by itself. */
async function startAi(page: Page, options: { who?: string; what?: string; skipGoto?: boolean } = {}) {
  if (!options.skipGoto) await page.goto('/')
  await page.getByRole('group', { name: 'Who would you like to send a card to?' }).getByRole('button', { name: options.who ?? 'Mom', exact: true }).click()
  await page.getByRole('group', { name: 'What would you like to say?' }).getByRole('button', { name: options.what ?? 'Birthday', exact: true }).click()
  await makeItForMe(page).click()
}

test.describe('Make it for me: client-side checks', () => {
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

  test('accepts only complete base64 JPEG data labelled as image/jpeg', () => {
    const jpegLike = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7), Buffer.from([0xff, 0xd9])]).toString('base64')
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

  test('picks the tone for the person, so nobody has to choose one', () => {
    expect(toneForRecipient('partner', 'Birthday')).toBe('romantic')
    expect(toneForRecipient('colleague', 'Thank you')).toBe('formal')
    expect(toneForRecipient('friend', 'Congratulations')).toBe('encouraging')
    expect(toneForRecipient('family', 'Birthday')).toBe('sweet')
    expect(toneForRecipient('friend', 'Just because')).toBe('heartfelt')
  })
})

test.describe('Make it for me in the app', () => {
  test('makes no AI or Turnstile requests on page load, or while choosing who and what', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request: Request) => requests.push(request.url()))
    await page.route(TURNSTILE_SCRIPT, (route) => route.fulfill({ contentType: 'text/javascript', body: fakeTurnstileScript }))
    await page.route(`${AI_ORIGIN}/**`, (route) => route.fulfill({ json: {} }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Mom', exact: true }).click()
    await page.getByRole('button', { name: 'Birthday', exact: true }).click()
    await expect(makeItForMe(page)).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(requests.filter((url) => url.startsWith(AI_ORIGIN) || url.includes('challenges.cloudflare.com'))).toEqual([])
  })

  test('asks only who and what: one click writes the message and adds a picture, with a fresh token for each and no names', async ({ page }) => {
    const image = await makeJpegBase64(page)
    const ai = await mockAi(page, { status: WITH_PICTURE, illustrate: pictureReply(image) })
    await page.goto('/')
    await page.getByRole('textbox', { name: /^To/ }).fill('Priya')
    await page.getByRole('textbox', { name: /^From/ }).fill('Sam')
    await startAi(page, { who: 'Mom', what: 'Get well soon', skipGoto: true })

    await expect(aiStatus(page)).toHaveText('Your card is ready below. You can change anything you like.')
    await expect(message(page)).toHaveValue(AI_MESSAGE)
    await expect(preview(page).locator('.card-preview')).toHaveClass(/card-layout-ai-top/)
    await expect(preview(page).locator('image.source-ai')).toHaveAttribute('href', /^blob:/)
    await expect(page.getByText('Written with AI help. Edit anything you like.')).toBeVisible()
    await expect(page.getByText('You can make 2 more cards with AI today.')).toBeVisible()

    expect(ai.generateBodies).toHaveLength(1)
    const body = ai.generateBodies[0]
    // Get well soon uses the "Just because" design set until it has artwork of its own.
    expect(body).toMatchObject({ turnstileToken: 'token-1-0', occasion: 'Just because', recipient: 'family', tone: 'sweet', personalMessage: '', extraInstructions: 'Card for: Mom. Occasion: Get well soon.' })
    expect(['botanical', 'celebration', 'painterly']).toContain(body.style)
    expect(ai.illustrateBodies).toEqual([{ turnstileToken: 'token-reset-1', occasion: 'Just because', style: body.style }])
    expect(JSON.stringify([...ai.generateBodies, ...ai.illustrateBodies])).not.toMatch(/Priya|Sam/)
  })

  test('asks for the occasion first if it hasn’t been chosen', async ({ page }) => {
    const ai = await mockAi(page)
    await page.goto('/')
    await makeItForMe(page).click()
    await expect(page.getByText('First, choose what you’d like to say in step 02 above.')).toBeVisible()
    expect(ai.statusCalls()).toBe(0)
  })

  test('maps partners, coworkers and “Other” to the right tone', async ({ page }) => {
    const ai = await mockAi(page)
    await startAi(page, { who: 'Husband / Wife', what: 'Anniversary' })
    await expect(message(page)).toHaveValue(AI_MESSAGE)
    expect(ai.generateBodies[0]).toMatchObject({ occasion: 'Love', recipient: 'partner', tone: 'romantic', extraInstructions: 'Card for: Husband / Wife. Occasion: Anniversary.' })
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    const second = await mockAi(page)
    await startAi(page, { who: 'Other', what: 'Thank you' })
    await expect(message(page)).toHaveValue(AI_MESSAGE)
    expect(second.generateBodies[0]).toMatchObject({ occasion: 'Thank you', recipient: 'someone', tone: 'heartfelt', extraInstructions: 'Card for: Someone special. Occasion: Thank you.' })
  })

  test('never starts a new card by itself when who or what changes afterwards', async ({ page }) => {
    const ai = await mockAi(page)
    await startAi(page)
    await expect(message(page)).toHaveValue(AI_MESSAGE)
    await page.getByRole('button', { name: 'Dad', exact: true }).click()
    await page.getByRole('button', { name: 'Thank you', exact: true }).click()
    await page.waitForTimeout(500)
    expect(ai.generateBodies).toHaveLength(1)
    await page.getByRole('button', { name: 'Make a new card' }).click()
    await expect.poll(() => ai.generateBodies.length).toBe(2)
    expect(ai.generateBodies[1]).toMatchObject({ occasion: 'Thank you', extraInstructions: 'Card for: Dad. Occasion: Thank you.' })
  })

  test('quietly uses a Little Hello design when no picture is left today', async ({ page }) => {
    const ai = await mockAi(page, { status: { enabled: true, signatureRemaining: 3, creativeRemaining: 0 } })
    await startAi(page)
    await expect(aiStatus(page)).toHaveText('Your card is ready below. You can change anything you like.')
    await expect(page.getByRole('button', { name: 'Choose Party time design' })).toHaveAttribute('aria-pressed', 'true')
    await expect(preview(page).locator('.card-layout-ai-top')).toHaveCount(0)
    expect(ai.illustrateBodies).toHaveLength(0)
  })

  test('keeps the finished card when the picture can’t be made, with a gentle note', async ({ page }) => {
    for (const failure of [{ status: 503, json: { error: 'budget_exhausted' } }, { status: 200, json: { image: 'not-a-jpeg', mimeType: 'image/jpeg' } }]) {
      await mockAi(page, { status: WITH_PICTURE, illustrate: () => failure })
      await startAi(page)
      await expect(aiStatus(page)).toHaveText('Your card is ready below. You can change anything you like. We used a Little Hello design for the picture.')
      await expect(message(page)).toHaveValue(AI_MESSAGE)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
    }
  })

  test('“Try another message” replaces only the words, keeping the picture and design', async ({ page }) => {
    const image = await makeJpegBase64(page)
    await mockAi(page, {
      status: WITH_PICTURE,
      illustrate: pictureReply(image),
      generate: (_, index) => ({ json: { message: index === 0 ? AI_MESSAGE : SECOND_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' } }),
    })
    await startAi(page)
    await expect(preview(page).locator('.card-layout-ai-top')).toBeVisible()
    await page.getByRole('button', { name: 'Try another message' }).click()
    await expect(message(page)).toHaveValue(SECOND_MESSAGE)
    await expect(aiStatus(page)).toHaveText('Here’s a new message. The picture and design stay the same.')
    await expect(preview(page).locator('.card-layout-ai-top')).toBeVisible()
  })

  test('shares a link with the Little Hello design and downloads the card with the picture', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-write'])
    const image = await makeJpegBase64(page)
    await mockAi(page, { status: WITH_PICTURE, illustrate: pictureReply(image) })
    await startAi(page)
    await expect(preview(page).locator('.card-layout-ai-top')).toBeVisible()
    await page.getByRole('button', { name: 'Copy Link' }).click()
    await expect(page.getByText('Link copied! It shows the Little Hello design. Download the card to keep the AI illustration.')).toBeVisible()
    const decoded = await decodeCardHash(new URL(await page.getByRole('textbox', { name: 'Share link' }).inputValue()).hash)
    expect(decoded?.ok && [decoded.card.template, decoded.card.message]).toEqual(['birthday-party-01', AI_MESSAGE])
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('little-hello-birthday-party-01-ai.png')
    const picture = await page.evaluate(async (dataUrl) => {
      const img = new Image()
      img.src = dataUrl
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(img, 0, 0)
      return Array.from(context.getImageData(540, 200, 1, 1).data.slice(0, 3))
    }, `data:image/png;base64,${readFileSync((await download.path())!).toString('base64')}`)
    expect(picture[2]).toBeGreaterThan(150)
    expect(picture[0]).toBeLessThan(80)
  })

  test('switches between the picture and the Little Hello design, and drops it when the occasion needs other designs', async ({ page }) => {
    const image = await makeJpegBase64(page)
    await mockAi(page, { status: WITH_PICTURE, illustrate: pictureReply(image) })
    await startAi(page)
    const card = preview(page).locator('.card-preview')
    await expect(card).toHaveClass(/card-layout-ai-top/)
    await page.getByRole('button', { name: 'Use the Little Hello design' }).click()
    await expect(card).not.toHaveClass(/card-layout-ai-top/)
    await page.getByRole('button', { name: 'Use my AI illustration' }).click()
    await expect(card).toHaveClass(/card-layout-ai-top/)
    await page.getByRole('button', { name: 'I love you', exact: true }).click()
    await expect(page.getByRole('button', { name: /Use my AI illustration|Use the Little Hello design/ })).toHaveCount(0)
  })

  test('asks before replacing a message the person already wrote', async ({ page }) => {
    const ai = await mockAi(page)
    await page.goto('/')
    await message(page).fill('My own careful words.')
    await startAi(page, { skipGoto: true })
    await expect(page.getByText('This will replace the message you wrote. Make a new one for you?')).toBeVisible()
    await page.waitForTimeout(300)
    expect(ai.generateBodies).toHaveLength(0)
    await expect(message(page)).toHaveValue('My own careful words.')
    await page.getByRole('button', { name: 'Yes, make it for me' }).click()
    await expect(message(page)).toHaveValue(AI_MESSAGE)
  })

  test('renders markup in a returned message as plain text, never as HTML', async ({ page }) => {
    const hostile = 'Happy day! <img src=x onerror="window.__xss=1"> <b>bold</b> and more words here.'
    await mockAi(page, { generate: () => ({ json: { message: hostile, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' } }) })
    await startAi(page)
    await expect(message(page)).toHaveValue(hostile)
    await expect(preview(page).getByText(hostile)).toBeVisible()
    await expect(preview(page).locator('.preview-message img, .preview-message b')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  })

  const failures: Array<[string, Reply, RegExp]> = [
    ['the daily budget is used up', { status: 503, json: { error: 'budget_exhausted' } }, /resting for today/],
    ['the person’s cards for today are used up', { status: 429, json: { error: 'daily_limit_reached' } }, /used today’s AI cards/],
    ['the cooldown is running', { status: 429, json: { error: 'rate_limited', retryAfterSeconds: 6 } }, /try again in 6 seconds/],
    ['writing fails after the server’s retry', { status: 502, json: { error: 'generation_failed' } }, /couldn’t write a card this time/],
    ['the human check fails', { status: 403, json: { error: 'verification_failed' } }, /confirm you’re human/],
    ['the reply doesn’t match the app’s data', { status: 200, json: { message: AI_MESSAGE, templateId: 'love-letter-01', messageFont: 'caveat', source: 'ai' } }, /couldn’t write a card this time/],
  ]
  for (const [label, reply, expected] of failures) {
    test(`explains in plain words, paints nothing and keeps the editor working when ${label}`, async ({ page }) => {
      const ai = await mockAi(page, { status: WITH_PICTURE, generate: () => reply })
      await page.goto('/')
      await message(page).fill('Typed before trying AI.')
      await startAi(page, { skipGoto: true })
      await page.getByRole('button', { name: 'Yes, make it for me' }).click()
      await expect(aiStatus(page)).toHaveText(expected)
      expect(ai.generateBodies).toHaveLength(1)
      expect(ai.illustrateBodies).toHaveLength(0)
      await expect(message(page)).toHaveValue('Typed before trying AI.')
      await message(page).fill('Still works without AI.')
      await expect(preview(page).getByText('Still works without AI.')).toBeVisible()
    })
  }

  test('explains when AI is off or today’s cards are used up, and makes no request', async ({ page }) => {
    const cases: Array<[unknown, RegExp]> = [
      [{ enabled: false, signatureRemaining: 0, creativeRemaining: 0 }, /isn’t available right now/],
      [{ enabled: true, signatureRemaining: 0, creativeRemaining: 1 }, /made today’s AI cards/],
    ]
    for (const [status, expected] of cases) {
      const ai = await mockAi(page, { status })
      await startAi(page)
      await expect(aiStatus(page)).toHaveText(expected)
      await page.waitForTimeout(300)
      expect(ai.generateBodies).toHaveLength(0)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
    }
  })

  test('reports a network failure without retrying from the browser', async ({ page }) => {
    let calls = 0
    await mockAi(page)
    await page.route(`${AI_ORIGIN}/v1/generate/message`, (route) => { calls++; return route.abort() })
    await startAi(page)
    await expect(aiStatus(page)).toHaveText(/couldn’t reach the AI helper/)
    await page.waitForTimeout(300)
    expect(calls).toBe(1)
  })

  test('can be stopped while writing, leaving the card unchanged and starting nothing new', async ({ page }) => {
    const ai = await mockAi(page, { generate: () => ({ ...defaultMessage({}, 0), delayMs: 3000 }) })
    await startAi(page)
    await expect(aiStatus(page)).toHaveText('Writing your message…')
    await page.getByRole('button', { name: 'Stop' }).click()
    await expect(aiStatus(page)).toHaveText('Cancelled. Nothing was changed.')
    await expect(message(page)).toHaveValue('')
    await page.waitForTimeout(500)
    expect(ai.generateBodies).toHaveLength(1)
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('can be stopped while painting, keeping the finished message', async ({ page }) => {
    const image = await makeJpegBase64(page)
    const ai = await mockAi(page, { status: WITH_PICTURE, illustrate: () => ({ ...pictureReply(image)({}, 0), delayMs: 3000 }) })
    await startAi(page)
    await expect(aiStatus(page)).toHaveText(/Now painting a picture/)
    await page.getByRole('button', { name: 'Stop' }).click()
    await expect(aiStatus(page)).toHaveText('Stopped. Your message is in the card below.')
    await expect(message(page)).toHaveValue(AI_MESSAGE)
    await page.waitForTimeout(500)
    expect([ai.generateBodies.length, ai.illustrateBodies.length]).toEqual([1, 1])
  })

  test('works offline as a normal card maker, explaining that AI needs the internet', async ({ page, context }) => {
    const ai = await mockAi(page)
    await page.goto('/')
    await context.setOffline(true)
    await startAi(page, { skipGoto: true })
    await expect(aiStatus(page)).toHaveText(/You’re offline/)
    expect(ai.statusCalls()).toBe(0)
    await message(page).fill('Offline card.')
    await expect(preview(page).getByText('Offline card.')).toBeVisible()
    await context.setOffline(false)
  })

  test('removes the Turnstile widget when another way of making the card is chosen', async ({ page }) => {
    await mockAi(page)
    await startAi(page)
    await expect(message(page)).toHaveValue(AI_MESSAGE)
    await page.getByRole('button', { name: /Write my own/ }).click()
    await expect(page.locator('.make-for-me')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __turnstile: { removes: number } }).__turnstile.removes)).toBe(1)
  })

  for (const viewport of [{ width: 320, height: 720 }, { width: 360, height: 800 }, { width: 768, height: 1000 }, { width: 1280, height: 900 }]) {
    test(`fits short, long and 500-character messages in every font without clipping or overlap at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      const image = await makeJpegBase64(page)
      await mockAi(page, { status: WITH_PICTURE, illustrate: pictureReply(image) })
      await startAi(page)
      await expect(preview(page).locator('.card-layout-ai-top')).toBeVisible()
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
            const panel = box('.preview-content')
            const messageBox = box('.preview-message')
            const from = box('.preview-from')
            const fontSize = parseFloat(getComputedStyle(card.querySelector('.preview-message')!).fontSize)
            return { cardBottom: card.getBoundingClientRect().bottom, panelTop: panel.top, messageTop: messageBox.top, messageBottom: messageBox.bottom, fromTop: from.top, fromBottom: from.bottom, fontSize }
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
