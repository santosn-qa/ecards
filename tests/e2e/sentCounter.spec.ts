import { expect, test } from '@playwright/test'
import { fetchSentCount, incrementSentCounter } from '../../src/counter/sentCounter'

function stubFetch(impl: typeof fetch) {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return () => {
    globalThis.fetch = original
  }
}

test.describe('sentCounter pure logic', () => {
  test('fetchSentCount returns null without calling fetch when apiUrl is unset', async () => {
    let called = false
    const restore = stubFetch(async () => {
      called = true
      throw new Error('should not be called')
    })
    try {
      expect(await fetchSentCount(undefined)).toBeNull()
      expect(called).toBe(false)
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns the parsed count on a successful response', async () => {
    const restore = stubFetch(async () => new Response(JSON.stringify({ count: 42 }), { status: 200 }))
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBe(42)
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns null on a non-2xx response', async () => {
    const restore = stubFetch(async () => new Response('error', { status: 500 }))
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBeNull()
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns null on malformed JSON', async () => {
    const restore = stubFetch(async () => new Response('not json', { status: 200 }))
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBeNull()
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns null when count is present but not a number', async () => {
    const restore = stubFetch(async () => new Response(JSON.stringify({ count: '42' }), { status: 200 }))
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBeNull()
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns null when the request rejects (offline/blocked)', async () => {
    const restore = stubFetch(async () => {
      throw new Error('network error')
    })
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBeNull()
    } finally {
      restore()
    }
  })

  test('incrementSentCounter does not call fetch when apiUrl is unset', () => {
    let called = false
    const restore = stubFetch(async () => {
      called = true
      return new Response()
    })
    try {
      incrementSentCounter(undefined)
      expect(called).toBe(false)
    } finally {
      restore()
    }
  })

  test('incrementSentCounter posts to the increment endpoint and never throws even when fetch rejects', () => {
    let requestedUrl: string | undefined
    let requestedMethod: string | undefined
    const restore = stubFetch(async (input, init) => {
      requestedUrl = String(input)
      requestedMethod = init?.method
      throw new Error('network error')
    })
    try {
      expect(() => incrementSentCounter('https://counter.example.test')).not.toThrow()
      expect(requestedUrl).toBe('https://counter.example.test/increment')
      expect(requestedMethod).toBe('POST')
    } finally {
      restore()
    }
  })
})

const COUNTER_ORIGIN = 'http://127.0.0.1:4174'

test.describe('SentCounter in the app', () => {
  test('renders the fetched count on load', async ({ page }) => {
    await page.route(`${COUNTER_ORIGIN}/count`, (route) =>
      route.fulfill({ json: { count: 1234 } }),
    )
    await page.goto('/')
    await expect(page.getByText('1,234 Little Hellos sent so far')).toBeVisible()
  })

  test('bumps the displayed count immediately after copying the link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-write'])
    await page.route(`${COUNTER_ORIGIN}/count`, (route) => route.fulfill({ json: { count: 5 } }))
    await page.route(`${COUNTER_ORIGIN}/increment`, (route) => route.fulfill({ json: { count: 6 } }))
    await page.goto('/')
    await expect(page.getByText('5 Little Hellos sent so far')).toBeVisible()

    await page.getByRole('textbox', { name: /Your message/ }).fill('A card worth keeping.')
    await page.getByRole('button', { name: 'Copy Link' }).click()

    await expect(page.getByText('6 Little Hellos sent so far')).toBeVisible()
  })

  test('bumps the displayed count immediately after downloading the card', async ({ page }) => {
    await page.route(`${COUNTER_ORIGIN}/count`, (route) => route.fulfill({ json: { count: 5 } }))
    await page.route(`${COUNTER_ORIGIN}/increment`, (route) => route.fulfill({ json: { count: 6 } }))
    await page.goto('/')
    await expect(page.getByText('5 Little Hellos sent so far')).toBeVisible()

    await page.getByRole('textbox', { name: /Your message/ }).fill('A card worth keeping.')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Card' }).click()
    await downloadPromise

    await expect(page.getByText('6 Little Hellos sent so far')).toBeVisible()
  })

  test('bumps the displayed count immediately after sharing the card', async ({ page }) => {
    await page.route(`${COUNTER_ORIGIN}/count`, (route) => route.fulfill({ json: { count: 5 } }))
    await page.route(`${COUNTER_ORIGIN}/increment`, (route) => route.fulfill({ json: { count: 6 } }))
    await page.addInitScript(() => {
      // jsdom-free Web Share stub: resolve immediately, like a completed share sheet.
      Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: () => Promise.resolve(),
      })
    })
    await page.goto('/')
    await expect(page.getByText('5 Little Hellos sent so far')).toBeVisible()

    await page.getByRole('textbox', { name: /Your message/ }).fill('A card worth keeping.')
    await page.getByRole('button', { name: 'Share Card' }).click()

    await expect(page.getByText('6 Little Hellos sent so far')).toBeVisible()
  })

  test('stays absent and does not break the card flow when the counter endpoint is unreachable', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-write'])
    const pageErrors: Error[] = []
    page.on('pageerror', (error) => pageErrors.push(error))
    await page.route(`${COUNTER_ORIGIN}/**`, (route) => route.abort())

    await page.goto('/')
    await expect(page.getByText(/Little Hellos sent so far/)).not.toBeAttached()

    await page.getByRole('textbox', { name: /Your message/ }).fill('A card worth keeping.')
    await page.getByRole('button', { name: 'Copy Link' }).click()
    await expect(page.getByRole('status')).toHaveText('Link copied!')

    await expect(page.getByText(/Little Hellos sent so far/)).not.toBeAttached()
    expect(pageErrors).toEqual([])
  })
})
