import { expect, test, type Page, type Request } from '@playwright/test'
import { parseSuggestion } from '../../src/ai/aiClient'
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

async function mockAi(page: Page, options: { status?: unknown; generate?: GenerateHandler } = {}) {
  const generateBodies: Array<Record<string, unknown>> = []
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
  return { generateBodies, statusCalls: () => statusCalls }
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
    await expect(panel.getByRole('status')).toHaveText('Your card is ready below. Edit anything you like.')
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
      await expect(panel.getByRole('status')).toHaveText(expected)
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
    await expect(panel.getByRole('status')).toHaveText(/isn’t available right now/)
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
    await expect(panel.getByRole('status')).toHaveText(/couldn’t reach the AI helper/)
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
    await expect(panel.getByRole('status')).toHaveText('Writing your card…')
    await panel.getByRole('button', { name: 'Cancel' }).click()
    await expect(panel.getByRole('status')).toHaveText('Cancelled. Nothing was changed.')
    await expect(message(page)).toHaveValue('Keep me.')
  })

  test('works offline as a normal card maker, with the helper explaining it needs a connection', async ({ page, context }) => {
    const ai = await mockAi(page)
    await page.goto('/')
    await context.setOffline(true)
    const panel = await openPanel(page)
    await expect(panel.getByRole('status')).toHaveText(/You’re offline/)
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
