# Ko-fi Support Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully optional, dismissible Ko-fi support prompt (after a successful download/share in the card editor) plus a small permanent footer link, gated by a single feature flag, with no backend, no tracking, and no card content ever touched.

**Architecture:** Three small new files (`src/config/support.ts` for the flag/URL, `src/support/supportPrompt.ts` for pure dismissal-window logic, and two presentational components) wired into the existing single-file `src/App.tsx` state machine at the three success points (`exportCard`, `shareCard`, `copyLink`) and the three existing footer renders.

**Tech Stack:** React 19 + TypeScript + Vite (existing). Testing stays Playwright-only (`@playwright/test`) — the repo has no unit-test framework, and adding one is out of scope. Pure logic is tested with plain Node-side Playwright `test()` blocks (no `page`); UI behavior is tested with browser-driven Playwright tests, extending the existing `tests/e2e/smoke.spec.ts` conventions in a new `tests/e2e/support.spec.ts`.

**Spec:** `docs/superpowers/specs/2026-09-12-kofi-support-integration-design.md`

---

### Task 1: Support config

**Files:**
- Create: `src/config/support.ts`

- [ ] **Step 1: Create the config file**

```ts
export const SUPPORT_CONFIG = {
  enabled: true,
  provider: 'kofi',
  url: 'https://ko-fi.com/nourilee',
} as const
```

This is the single source of truth used by every other file in this plan. Setting `enabled: false` here and rebuilding is the beta kill switch — no other code changes needed.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes with no errors (this file has no consumers yet, so it just needs to compile standalone).

- [ ] **Step 3: Commit**

```bash
git add src/config/support.ts
git commit -m "feat: add centralized Ko-fi support config"
```

---

### Task 2: Dismissal-window logic (TDD)

**Files:**
- Create: `src/support/supportPrompt.ts`
- Test: `tests/e2e/support.spec.ts` (pure-logic section)

This is the only piece of real logic in the feature: given "now," a stored dismissal timestamp, and whether the feature is enabled, decide whether to show the prompt. It has no DOM dependency at import time, so it's tested directly with Node-side Playwright `test()` blocks — no browser needed.

- [ ] **Step 1: Write the failing tests**

Create `tests/e2e/support.spec.ts` with this content (the browser-driven tests will be appended to this same file in later tasks):

```ts
import { expect, test } from '@playwright/test'
import {
  SUPPORT_DISMISS_STORAGE_KEY,
  readDismissedAt,
  recordDismissal,
  shouldShowSupportPrompt,
} from '../../src/support/supportPrompt'

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test tests/e2e/support.spec.ts -g "supportPrompt pure logic"`
Expected: FAIL — `Cannot find module '../../src/support/supportPrompt'` (the module doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/support/supportPrompt.ts`:

```ts
const SUPPRESSION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const SUPPORT_DISMISS_STORAGE_KEY = 'littleHelloSupportDismissedAt'

export function shouldShowSupportPrompt(now: number, dismissedAt: number | null, enabled: boolean): boolean {
  if (!enabled) return false
  if (dismissedAt === null) return true
  return now - dismissedAt >= SUPPRESSION_WINDOW_MS
}

export function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(SUPPORT_DISMISS_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function recordDismissal(now: number): void {
  try {
    localStorage.setItem(SUPPORT_DISMISS_STORAGE_KEY, String(now))
  } catch {
    // localStorage unavailable (private mode, quota, disabled) — fail open.
  }
}
```

Note: in the Node-side test environment `localStorage` is genuinely undefined, so `readDismissedAt`/`recordDismissal` exercise the real fail-open path — no mocking needed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/e2e/support.spec.ts -g "supportPrompt pure logic"`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/support/supportPrompt.ts tests/e2e/support.spec.ts
git commit -m "feat: add support-prompt dismissal window logic"
```

---

### Task 3: Support UI components

**Files:**
- Create: `src/components/SupportPanel.tsx`
- Create: `src/components/SupportFooterLink.tsx`

These are presentational only; their behavior (when they're rendered) is driven by `App.tsx` in Task 5 and verified by the browser tests in Task 4. No isolated component test — there's no React testing library in this repo (only Playwright), and the meaningful logic is already covered in Task 2.

- [ ] **Step 1: Create the footer link component**

```tsx
import { SUPPORT_CONFIG } from '../config/support'

export function SupportFooterLink() {
  if (!SUPPORT_CONFIG.enabled) return null
  return (
    <a href={SUPPORT_CONFIG.url} target="_blank" rel="noopener noreferrer">
      Support Little Hello
    </a>
  )
}
```

- [ ] **Step 2: Create the support panel component**

```tsx
import { SUPPORT_CONFIG } from '../config/support'

type SupportPanelProps = {
  onDismiss: () => void
}

export function SupportPanel({ onDismiss }: SupportPanelProps) {
  return (
    <div className="support-panel" role="region" aria-label="Support Little Hello prompt">
      <p className="support-panel-heading">
        <span aria-hidden="true">💌</span> Send a little love back
      </p>
      <p className="support-panel-body">
        Little Hello is free, with no ads or paywalls. If this helped you make
        someone’s day a little brighter, you can help keep Little Hello going.
      </p>
      <p className="support-panel-privacy">
        We never see your card, your message, or any personal details — this
        just opens Ko-fi in a new tab.
      </p>
      <div className="support-panel-actions">
        <a
          className="primary-action"
          href={SUPPORT_CONFIG.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDismiss}
        >
          Support Little Hello
        </a>
        <button type="button" className="secondary-action" aria-label="Dismiss support message" onClick={onDismiss}>
          No thanks
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes (components aren't imported anywhere yet, but they must still type-check standalone).

- [ ] **Step 4: Commit**

```bash
git add src/components/SupportPanel.tsx src/components/SupportFooterLink.tsx
git commit -m "feat: add SupportPanel and SupportFooterLink components"
```

---

### Task 4: Browser-driven tests (write first, expect failures)

**Files:**
- Modify: `tests/e2e/support.spec.ts` (append to the file from Task 2)

Written before the `App.tsx` wiring in Task 5, so they fail for the right reason first (panel/link don't render yet), then pass once Task 5 is done.

- [ ] **Step 1: Append these tests to `tests/e2e/support.spec.ts`**

```ts
import { SUPPORT_CONFIG } from '../../src/config/support'

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
```

- [ ] **Step 2: Run the new tests to verify they fail for the right reason**

Run: `npx playwright test tests/e2e/support.spec.ts -g "support panel and footer link"`
Expected: FAIL — no element found with role "region" and name "Support Little Hello prompt" (and no footer link), because `App.tsx` doesn't render either component yet.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/support.spec.ts
git commit -m "test: add failing browser tests for the Ko-fi support prompt and footer link"
```

---

### Task 5: Wire the panel and footer link into `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add imports**

In `src/App.tsx`, add to the top of the import block (after the existing imports, before `./App.css`):

```tsx
import { SUPPORT_CONFIG } from './config/support'
import { readDismissedAt, recordDismissal, shouldShowSupportPrompt } from './support/supportPrompt'
import { SupportPanel } from './components/SupportPanel'
import { SupportFooterLink } from './components/SupportFooterLink'
```

Also change the React import line to add `useRef`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
```

- [ ] **Step 2: Add state and handlers**

Inside the `App` function, after the existing `const [isExporting, setIsExporting] = useState(false)` line, add:

```tsx
  const [showSupportPanel, setShowSupportPanel] = useState(false)
  const hasShownSupportPanelRef = useRef(false)
```

After `visibleTemplates`/`selectedTemplate` (anywhere before `copyLink`/`shareCard`/`exportCard` is fine — place it directly above `async function copyLink()`), add:

```tsx
  function maybeShowSupportPanel() {
    if (hasShownSupportPanelRef.current) return
    if (!shouldShowSupportPrompt(Date.now(), readDismissedAt(), SUPPORT_CONFIG.enabled)) return
    hasShownSupportPanelRef.current = true
    setShowSupportPanel(true)
  }

  function dismissSupportPanel() {
    recordDismissal(Date.now())
    setShowSupportPanel(false)
  }
```

- [ ] **Step 3: Call `maybeShowSupportPanel()` on each success path**

Modify `copyLink`, `shareCard`, and `exportCard`:

```tsx
  async function copyLink() {
    const url = createCardUrl(draft, selectedTemplate.id)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(url)
      setNotice('Link copied!')
      maybeShowSupportPanel()
    } catch {
      setNotice('Copy failed. You can select the link below.')
    }
  }

  async function shareCard() {
    const url = createCardUrl(draft, selectedTemplate.id)
    if ('share' in navigator) {
      try {
        await navigator.share({ title: 'A Little Hello card', text: 'Someone made a card for you.', url })
        setNotice('Ready to share!')
        maybeShowSupportPanel()
      } catch {
        setNotice('Sharing was cancelled.')
      }
    } else {
      await copyLink()
    }
  }

  async function exportCard() {
    setIsExporting(true)
    try {
      await downloadCardPng(draft, selectedTemplate)
      setNotice('Card downloaded!')
      maybeShowSupportPanel()
    } catch {
      setNotice('The card could not be downloaded. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }
```

- [ ] **Step 4: Render the panel in the editor**

Find this line in the JSX (inside `.editor-panel`):

```tsx
              <p className="action-status" role="status" aria-live="polite">{notice || `Your share link is ready: ${currentUrl}`}</p>
```

Add the panel directly after it:

```tsx
              <p className="action-status" role="status" aria-live="polite">{notice || `Your share link is ready: ${currentUrl}`}</p>
              {showSupportPanel && <SupportPanel onDismiss={dismissSupportPanel} />}
```

- [ ] **Step 5: Add the footer link to all three footers**

There are three identical-shaped `<footer className="site-footer">` blocks in `src/App.tsx`: the shared-success view, the shared-error view, and the main editor view. In each one, change:

```tsx
          <span>Created by <a href="https://www.linkedin.com/in/nourileesantos/" target="_blank" rel="noopener noreferrer">Nourilee Santos</a></span>
```

to:

```tsx
          <span>
            Created by <a href="https://www.linkedin.com/in/nourileesantos/" target="_blank" rel="noopener noreferrer">Nourilee Santos</a>
            {SUPPORT_CONFIG.enabled && <> · <SupportFooterLink /></>}
          </span>
```

(Do this in all three footers — lines currently at roughly `App.tsx:56`, `App.tsx:85`, and `App.tsx:237` before this edit; search for the exact string above with your editor to catch all three.)

- [ ] **Step 6: Add panel styles to `src/App.css`**

Append to the end of `src/App.css`:

```css
.support-panel { margin-top: 18px; padding: 20px 22px; border: 1px solid #e8e1dd; border-radius: 14px; background: #fff8f4; }
.support-panel-heading { margin: 0 0 8px; color: #4d4643; font-size: .95rem; font-weight: 600; }
.support-panel-body { margin: 0 0 10px; color: #716965; font-size: .82rem; line-height: 1.55; }
.support-panel-privacy { margin: 0 0 16px; color: #9b928e; font-size: .72rem; line-height: 1.5; }
.support-panel-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
```

- [ ] **Step 7: Run the Task 4 tests to verify they now pass**

Run: `npx playwright test tests/e2e/support.spec.ts`
Expected: PASS (all pure-logic and browser tests).

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: wire the Ko-fi support panel and footer link into the card flow"
```

---

### Task 6: Full regression pass and manual flag check

**Files:** none (verification only)

- [ ] **Step 1: Run the full existing + new test suite**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all pass, including the pre-existing `tests/e2e/smoke.spec.ts` suite (card creation, template selection, message fonts, shared URLs, PNG download fidelity) and the new `tests/e2e/support.spec.ts`.

If anything in `smoke.spec.ts` fails, stop and classify the failure (application defect vs. automation defect vs. environment issue) before touching any code — do not weaken or delete the failing assertion.

- [ ] **Step 2: Manually verify the kill switch**

This is the one thing not covered by an automated test, because `SUPPORT_CONFIG` is a build-time constant and there's no env-driven toggle (per the spec, no "complicated feature-flag service" is needed for this beta).

1. Temporarily edit `src/config/support.ts`: set `enabled: false`.
2. Run `npm run dev`, open the app.
3. Confirm: no footer link on the editor view; create a card, download it, confirm no support panel appears.
4. Open a shared card URL, confirm no footer link there either.
5. Revert the edit back to `enabled: true`.

- [ ] **Step 3: Manual mobile pass in a real browser**

Using the already-running dev server (or `npm run preview` after `npm run build`), open Chrome DevTools device emulation (or an actual phone) at 320px, 375px, 390px, and 430px widths and confirm:

- No horizontal scroll on the editor view or after the support panel appears.
- The "Support Little Hello" and "No thanks" controls are each comfortably tappable and don't overlap the Download/Share buttons.
- The footer link is visible but clearly secondary to "Created by…".

- [ ] **Step 4: Final commit (if Step 2 left any stray diff)**

```bash
git status
```

Expected: clean (Step 2's edit was reverted). If `git status` shows a lingering change to `src/config/support.ts`, revert it before finishing:

```bash
git checkout -- src/config/support.ts
```

---

## Manual configuration required after this plan is executed

None — the real Ko-fi URL (`https://ko-fi.com/nourilee`) is already baked into `src/config/support.ts` in Task 1, not a placeholder. Disabling the feature later only requires flipping `SUPPORT_CONFIG.enabled` to `false` and rebuilding.
