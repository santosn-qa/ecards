# Sent Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one encouraging public number — "💌 N Little Hellos sent so far" — near the top of the app, backed by a single anonymous integer counter, with no card content or per-user data ever transmitted, and the feature fully inert (no requests, no UI) whenever it isn't configured.

**Architecture:** A standalone Cloudflare Worker + KV namespace (`worker/`, deployed independently of the Vite app) exposes `GET /count` and `POST /increment` for one integer. The React app gets a small isolated module (`src/config/counter.ts` for the build-time-configured endpoint, `src/counter/sentCounter.ts` for the fetch wrapper, `src/counter/useSentCounter.ts` for the state hook) plus one presentational component (`src/components/SentCounter.tsx`), wired into `src/App.tsx`'s existing three success paths (`copyLink`, `shareCard`, `exportCard`) and rendered once in the hero section.

**Tech Stack:** React 19 + TypeScript + Vite (existing app). Cloudflare Workers + Workers KV via `wrangler` (new, isolated in `worker/`, not part of the app's build). Testing stays Playwright-only, following this repo's existing pattern: pure logic tested with plain Node-side `test()` blocks (no `page`), UI behavior tested with browser-driven tests using route mocking, in a new `tests/e2e/sentCounter.spec.ts`. The Worker itself is verified manually (curl), documented in `worker/README.md` — it's a small independent unit outside the main app's test suite, matching the spec's decision.

**Spec:** `docs/superpowers/specs/2026-09-13-sent-counter-design.md`

---

### Task 1: Cloudflare Worker (backend counter)

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`
- Create: `worker/README.md`

This is a standalone deployable unit, not part of `npm run build` for the main app. It has no automated test suite (per the spec) — verification is manual, via `wrangler dev` and `curl`.

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "little-hello-counter-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.0.0",
    "@cloudflare/workers-types": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "module": "es2022",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `worker/wrangler.toml`**

```toml
name = "little-hello-counter"
main = "src/index.ts"
compatibility_date = "2026-09-13"

kv_namespaces = [
  { binding = "COUNTER_KV", id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID" }
]
```

- [ ] **Step 4: Create `worker/src/index.ts`**

```ts
export interface Env {
  COUNTER_KV: KVNamespace
}

// Replace with the real production origin(s) before deploying. GitHub Pages
// URL is included so the default deployment target works out of the box.
const ALLOWED_ORIGINS = new Set<string>([
  'https://nourileesantos.github.io',
])

const COUNT_KEY = 'sent_count'
const DEBOUNCE_TTL_SECONDS = 60 // Cloudflare KV's minimum expirationTtl.

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }
  return headers
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const headers = corsHeaders(origin)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...headers,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (request.method === 'GET' && url.pathname === '/count') {
      const raw = await env.COUNTER_KV.get(COUNT_KEY)
      const count = raw ? Number(raw) : 0
      return new Response(JSON.stringify({ count }), { headers })
    }

    if (request.method === 'POST' && url.pathname === '/increment') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      const debounceKey = `debounce:${await hashIp(ip)}`
      const [alreadyRecent, raw] = await Promise.all([
        env.COUNTER_KV.get(debounceKey),
        env.COUNTER_KV.get(COUNT_KEY),
      ])
      const current = raw ? Number(raw) : 0

      if (alreadyRecent) {
        return new Response(JSON.stringify({ count: current }), { headers })
      }

      const next = current + 1
      await Promise.all([
        env.COUNTER_KV.put(COUNT_KEY, String(next)),
        env.COUNTER_KV.put(debounceKey, '1', { expirationTtl: DEBOUNCE_TTL_SECONDS }),
      ])
      return new Response(JSON.stringify({ count: next }), { headers })
    }

    return new Response('Not found', { status: 404, headers })
  },
}
```

- [ ] **Step 5: Create `worker/README.md`**

```markdown
# Little Hello — Sent Counter Worker

A tiny Cloudflare Worker holding one anonymous integer: how many times a
Little Hello card has been shared, copied, or downloaded. No card content,
no personal data, no cookies, no per-user identifiers are ever stored or
transmitted — see `docs/superpowers/specs/2026-09-13-sent-counter-design.md`
in the main repo for the full privacy boundary.

## One-time setup

1. Install dependencies: `npm install`
2. Log in to Cloudflare: `npx wrangler login`
3. Create the KV namespace: `npx wrangler kv namespace create COUNTER_KV`
4. Copy the returned `id` into `wrangler.toml`'s `kv_namespaces[0].id`.
5. Edit `ALLOWED_ORIGINS` in `src/index.ts` to include your real production
   domain (the GitHub Pages URL is included by default).

## Deploy

```bash
npm run deploy
```

This prints the Worker's URL (e.g. `https://little-hello-counter.<you>.workers.dev`).
Set that as `VITE_COUNTER_API_URL` in the main app's build (see the main
repo's README and `.github/workflows/deploy.yml`) to turn the feature on.

## Local development

```bash
npm run dev
```

## Manual verification (no automated test suite for this Worker)

With `npm run dev` running (defaults to `http://localhost:8787`):

```bash
# Read the current count (starts at 0 until KV is written to)
curl http://localhost:8787/count

# Increment it
curl -X POST http://localhost:8787/increment

# Confirm the debounce: calling increment again immediately returns the same
# count instead of bumping it again
curl -X POST http://localhost:8787/increment

# Confirm /count now reflects the single increment
curl http://localhost:8787/count
```

Expected: the first `/increment` returns `{"count":1}`; the immediate second
call also returns `{"count":1}` (debounced, not double-counted); `/count`
confirms `1`. Waiting 60+ seconds between calls allows a new increment.

## Known limitations (accepted, not bugs)

- The 60-second per-IP debounce is Cloudflare KV's minimum `expirationTtl` —
  it stops accidental double-counts, not determined abuse.
- This is a feel-good approximate number, not an audited metric.
```

- [ ] **Step 6: Install dependencies and verify locally**

Run:
```bash
cd worker && npm install
```
Expected: installs `wrangler` and `@cloudflare/workers-types` with no errors.

If you have a Cloudflare account available, follow `worker/README.md`'s
one-time setup (steps 2–4) and manually run through the "Manual
verification" curl commands to confirm the debounce and increment behavior
before moving on. If no Cloudflare account is available in this environment,
note that in your task report and continue — Task 8 documents this as a
manual step the project owner completes separately, and the client-side
tasks below don't require a live Worker to develop or test against (they use
mocked routes).

- [ ] **Step 7: Commit**

```bash
cd .. && git add worker/
git commit -m "feat: add Cloudflare Worker for the anonymous sent counter"
```

---

### Task 2: Counter config and fetch wrapper (TDD)

**Files:**
- Create: `src/config/counter.ts`
- Create: `src/counter/sentCounter.ts`
- Test: `tests/e2e/sentCounter.spec.ts` (pure-logic section)

This is the only real logic on the client side: read the configured endpoint
(if any), and provide two functions that talk to it without ever throwing.
Both accept an optional `apiUrl` override (defaulting to the real config) so
tests can exercise every branch without depending on a live Worker or a
Vite-processed build.

- [ ] **Step 1: Create `src/config/counter.ts`**

```ts
// `import.meta.env.VITE_COUNTER_API_URL` only exists in a Vite-processed
// context (dev server or build). Optional-chaining on `.env` keeps this
// import safe when a test file imports this module directly through
// Playwright's plain Node/TypeScript runner, where `import.meta.env` is
// undefined.
export const COUNTER_CONFIG = {
  apiUrl: import.meta.env?.VITE_COUNTER_API_URL as string | undefined,
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/e2e/sentCounter.spec.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx playwright test tests/e2e/sentCounter.spec.ts -g "sentCounter pure logic"`
Expected: FAIL — `Cannot find module '../../src/counter/sentCounter'` (the module doesn't exist yet).

- [ ] **Step 4: Write the minimal implementation**

Create `src/counter/sentCounter.ts`:

```ts
import { COUNTER_CONFIG } from '../config/counter'

export async function fetchSentCount(apiUrl: string | undefined = COUNTER_CONFIG.apiUrl): Promise<number | null> {
  if (!apiUrl) return null
  try {
    const response = await fetch(`${apiUrl}/count`)
    if (!response.ok) return null
    const data = (await response.json()) as { count?: unknown }
    return typeof data.count === 'number' ? data.count : null
  } catch {
    return null
  }
}

export function incrementSentCounter(apiUrl: string | undefined = COUNTER_CONFIG.apiUrl): void {
  if (!apiUrl) return
  fetch(`${apiUrl}/increment`, { method: 'POST' }).catch(() => {
    // Best-effort only — a failed increment never affects the card flow.
  })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx playwright test tests/e2e/sentCounter.spec.ts -g "sentCounter pure logic"`
Expected: PASS (7 tests).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: passes with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/config/counter.ts src/counter/sentCounter.ts tests/e2e/sentCounter.spec.ts
git commit -m "feat: add sent-counter config and fetch wrapper"
```

---

### Task 3: `useSentCounter` hook and `SentCounter` component

**Files:**
- Create: `src/counter/useSentCounter.ts`
- Create: `src/components/SentCounter.tsx`

These have no isolated unit test — there's no React Testing Library in this
repo, and a hook that just wraps the already-tested Task 2 functions in
`useState`/`useEffect` isn't meaningfully testable outside a rendered page.
Behavior is verified end-to-end in Task 5's browser tests, once wired into
`App.tsx`.

- [ ] **Step 1: Create `src/counter/useSentCounter.ts`**

```ts
import { useEffect, useState } from 'react'
import { fetchSentCount, incrementSentCounter } from './sentCounter'

export function useSentCounter() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSentCount().then((value) => {
      if (!cancelled) setCount(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function bump() {
    setCount((current) => (current === null ? current : current + 1))
    incrementSentCounter()
  }

  return { count, bump }
}
```

- [ ] **Step 2: Create `src/components/SentCounter.tsx`**

```tsx
type SentCounterProps = {
  count: number | null
}

export function SentCounter({ count }: SentCounterProps) {
  if (count === null) return null
  return (
    <p className="sent-counter">
      <span aria-hidden="true">💌</span> {count.toLocaleString()} Little Hellos sent so far
    </p>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes (neither file is imported anywhere yet, but both must compile standalone).

- [ ] **Step 4: Commit**

```bash
git add src/counter/useSentCounter.ts src/components/SentCounter.tsx
git commit -m "feat: add useSentCounter hook and SentCounter component"
```

---

### Task 4: Bake a test-only counter endpoint into the Playwright build

**Files:**
- Modify: `playwright.config.ts`

The e2e suite builds the app once (`npm run build && npm run preview`) and
reuses that server for every test. Vite only bakes `VITE_*` env vars in at
build time, so the shared build needs a fixed (fake) `VITE_COUNTER_API_URL`
for the upcoming browser tests to mock routes against. Pointing it at an
unused local port means any test that doesn't explicitly mock the counter
routes gets a fast, deterministic connection failure (feature silently
absent) rather than a real network call or a hanging DNS lookup — this
matches how the feature behaves today with no endpoint configured at all,
just via a different failure path (network refusal instead of unset config,
both already covered: unset is tested in Task 2, refusal is tested in
Task 5).

- [ ] **Step 1: Add the env var to the webServer config**

In `playwright.config.ts`, change:

```ts
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
```

to:

```ts
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_COUNTER_API_URL: 'http://127.0.0.1:4174',
    },
  },
```

- [ ] **Step 2: Rebuild and confirm the existing suite still passes**

Run: `npm test`
Expected: PASS — the existing suite (`smoke.spec.ts`, `support.spec.ts`,
`codec.spec.ts`, `sampleMessages.spec.ts`, `typography.spec.ts`,
`sentCounter.spec.ts`'s pure-logic section) is unaffected, since nothing yet
renders `SentCounter` or calls `incrementSentCounter` from `App.tsx`.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "test: configure a fixed sent-counter endpoint for the e2e build"
```

---

### Task 5: Browser-driven tests (write first, expect failures)

**Files:**
- Modify: `tests/e2e/sentCounter.spec.ts` (append to the file from Task 2)

Written before the `App.tsx` wiring in Task 6, so they fail for the right
reason first (nothing renders `SentCounter` or calls the increment
functions yet), then pass once Task 6 is done.

- [ ] **Step 1: Append these tests to `tests/e2e/sentCounter.spec.ts`**

```ts
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
```

- [ ] **Step 2: Run the new tests to verify they fail for the right reason**

Run: `npx playwright test tests/e2e/sentCounter.spec.ts -g "SentCounter in the app"`
Expected: FAIL — no element found with text "Little Hellos sent so far", because `App.tsx` doesn't render `SentCounter` or call the counter functions yet.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/sentCounter.spec.ts
git commit -m "test: add failing browser tests for the sent counter"
```

---

### Task 6: Wire the counter into `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add imports**

In `src/App.tsx`, add to the import block (after the existing `SupportFooterLink` import, before `./App.css`):

```tsx
import { useSentCounter } from './counter/useSentCounter'
import { SentCounter } from './components/SentCounter'
```

- [ ] **Step 2: Call the hook inside `App`**

After the existing `const [showSupportPanel, setShowSupportPanel] = useState(false)` line, add:

```tsx
  const { count: sentCount, bump: bumpSentCounter } = useSentCounter()
```

- [ ] **Step 3: Bump the counter on each success path**

Modify `copyLink`, `shareCard`, and `exportCard` to call `bumpSentCounter()`
alongside the existing `maybeShowSupportPanel()` calls:

```tsx
  async function copyLink(options?: { skipEmptyGuard?: boolean }) {
    if (!options?.skipEmptyGuard && !confirmOrWarnEmptyMessage('Copy Link')) return
    const url = await createCardUrl(draft, selectedTemplate.id)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(url)
      setNotice('Link copied!')
      maybeShowSupportPanel()
      bumpSentCounter()
    } catch {
      setNotice('Copy failed. You can select the link below.')
    }
  }

  async function shareCard() {
    if (!confirmOrWarnEmptyMessage('Share Card')) return
    const url = await createCardUrl(draft, selectedTemplate.id)
    if ('share' in navigator) {
      try {
        await navigator.share({ title: 'A Little Hello card', text: 'Someone made a card for you.', url })
        setNotice('Ready to share!')
        maybeShowSupportPanel()
        bumpSentCounter()
      } catch {
        setNotice('Sharing was cancelled.')
      }
    } else {
      await copyLink({ skipEmptyGuard: true })
    }
  }

  async function exportCard() {
    if (!confirmOrWarnEmptyMessage('Download Card')) return
    setIsExporting(true)
    try {
      await downloadCardPng(draft, selectedTemplate)
      setNotice('Card downloaded!')
      maybeShowSupportPanel()
      bumpSentCounter()
    } catch {
      setNotice('The card could not be downloaded. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }
```

Note: the `shareCard` fallback branch (`else { await copyLink(...) }`) does
not need its own `bumpSentCounter()` call — it delegates to `copyLink`,
which already bumps on its own success path. Calling it in both places
would double-count that path.

- [ ] **Step 4: Render the tagline in the hero section**

Find this block:

```tsx
        <section className="hero-section" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="eyebrow">A small gesture, made special</p>
            <h1 id="welcome-title">Make someone’s day.</h1>
            <p className="hero-text">Choose a beautiful design, add your words, and share a little hello. No account needed.</p>
          </div>
          <div className="hero-sparkles" aria-hidden="true"><span>✦</span><span>✧</span><span>·</span></div>
        </section>
```

Change it to:

```tsx
        <section className="hero-section" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="eyebrow">A small gesture, made special</p>
            <h1 id="welcome-title">Make someone’s day.</h1>
            <p className="hero-text">Choose a beautiful design, add your words, and share a little hello. No account needed.</p>
            <SentCounter count={sentCount} />
          </div>
          <div className="hero-sparkles" aria-hidden="true"><span>✦</span><span>✧</span><span>·</span></div>
        </section>
```

- [ ] **Step 5: Add the tagline style to `src/App.css`**

Append to the end of `src/App.css`:

```css
.sent-counter { margin: 16px 0 0; color: #d26f4f; font-size: .85rem; font-weight: 600; }
.sent-counter span { margin-right: 4px; }
```

- [ ] **Step 6: Run the Task 5 tests to verify they now pass**

Run: `npx playwright test tests/e2e/sentCounter.spec.ts`
Expected: PASS (all pure-logic and browser tests, 12 total).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: wire the sent counter into the card creation flow"
```

---

### Task 7: README documentation

**Files:**
- Modify: `README.md`

Document this as an explicit, narrow exception to the project's "no backend,
no analytics" principle, matching how the Ko-fi integration is already
documented nearby.

- [ ] **Step 1: Add a subsection under "Architecture review"**

In `README.md`, find the "Privacy" bullet under "Architecture review" and
add a new bullet directly after it:

```markdown
- **Sent counter (one narrow exception):** a single public tagline ("N
  Little Hellos sent so far") is powered by a small external Cloudflare
  Worker holding one anonymous integer. This is the one deliberate exception
  to "no backend" in this document — it never receives card content, names,
  identifiers, or cookies, only a bare "one more happened" signal. Full
  scope and privacy boundary: `docs/superpowers/specs/2026-09-13-sent-counter-design.md`.
  Leaving `VITE_COUNTER_API_URL` unset (the default for local dev and forks)
  fully disables the feature: no requests, no UI. Worker setup:
  `worker/README.md`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document the sent-counter exception to the no-backend principle"
```

---

### Task 8: Deploy workflow wiring and full regression pass

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Pass the counter endpoint through to the production build**

In `.github/workflows/deploy.yml`, change:

```yaml
      - name: Build
        run: npm run build
        env:
          VITE_BASE_PATH: /${{ github.event.repository.name }}/
```

to:

```yaml
      - name: Build
        run: npm run build
        env:
          VITE_BASE_PATH: /${{ github.event.repository.name }}/
          VITE_COUNTER_API_URL: ${{ vars.VITE_COUNTER_API_URL }}
```

If the repository variable `VITE_COUNTER_API_URL` isn't set, this evaluates
to an empty string, which `COUNTER_CONFIG`/`fetchSentCount`/
`incrementSentCounter` already treat as "unset" — the deployed site simply
won't show the tagline until the variable is configured (see Task 9).

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: pass the sent-counter endpoint through to the Pages build"
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all pass, including every pre-existing spec file and the new
`tests/e2e/sentCounter.spec.ts`.

If anything in the pre-existing suite fails, stop and classify the failure
(application defect vs. automation defect vs. environment issue) before
touching any code — do not weaken or delete a failing assertion.

- [ ] **Step 4: Manual verification that the feature is inert by default**

1. Run `npm run dev` with no `VITE_COUNTER_API_URL` set in your shell.
2. Open the app and confirm no tagline appears in the hero section.
3. Open the browser's network tab, perform a Copy Link/Share/Download, and
   confirm no request to any counter endpoint is attempted.

---

## Manual configuration required after this plan is executed

This plan ships the feature fully wired but **inert by default** — nothing
changes for users until the project owner completes these steps, which
require a Cloudflare account and cannot be done by an automated worker:

1. In `worker/`, follow `worker/README.md`'s one-time setup: `wrangler login`,
   create the `COUNTER_KV` namespace, paste its id into `worker/wrangler.toml`,
   update `ALLOWED_ORIGINS` in `worker/src/index.ts` for the real production
   domain, then `npm run deploy`.
2. In the GitHub repository's Settings → Secrets and variables → Actions →
   Variables, add a repository variable named `VITE_COUNTER_API_URL` set to
   the deployed Worker's URL (e.g. `https://little-hello-counter.<you>.workers.dev`,
   no trailing slash).
3. Push to `main` (or re-run the deploy workflow) to pick up the new
   variable — the tagline will then appear on the live site.

Until step 2 is done, the deployed site behaves exactly as it does today.
