# Compact Share Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the generated share link (short JSON keys + native deflate compression) while keeping every byte of card content client-side — no third-party shortener, no backend.

**Architecture:** New `#/card/v2/<payload>` link format runs short-keyed JSON through `CompressionStream('deflate-raw')` before base64url-encoding. The old `#/card/<payload>` format (verbose JSON, no compression) keeps decoding forever via an unchanged code path, routed to by matching on URL shape rather than by decoding first. `encodeCard`/`createCardUrl`/`decodeCardHash` become `async`; `App.tsx` gains small async-safe wrappers (generation-counter guards) around the live share-link field and the initial/hashchange shared-card routing so a fast typist or a shared-card visitor never sees a stale or flashed-wrong render.

**Tech Stack:** TypeScript, React 19, native `CompressionStream`/`DecompressionStream` Web Streams API (no new dependency), Playwright for tests (this repo has no unit-test framework — pure-logic tests run as plain Node-side Playwright tests, matching the existing `tests/e2e/support.spec.ts` pattern).

**Reference:** Full design rationale in `docs/superpowers/specs/2026-09-12-compact-share-link-design.md`.

---

### Task 1: Compact payload encode/decode (pure logic)

**Files:**
- Modify: `src/card/codec.ts`
- Test: `tests/e2e/codec.spec.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/e2e/codec.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { encodeCard, decodeCardHash } from '../../src/card/codec'
import type { CardDraft } from '../../src/data/templates'

const sampleDraft: CardDraft = {
  to: 'Mom',
  message: 'Happy birthday! Hope your day is filled with joy and cake.',
  from: 'Alex',
  messageFont: 'dancing-script',
}

test.describe('compact (v2) card codec pure logic', () => {
  test('round-trips a full draft through encode and decode', async () => {
    const payload = await encodeCard(sampleDraft, 'birthday-party-01')
    const result = await decodeCardHash(`#/card/v2/${payload}`)
    expect(result?.ok).toBe(true)
    if (result?.ok) {
      expect(result.card.template).toBe('birthday-party-01')
      expect(result.card.to).toBe('Mom')
      expect(result.card.message).toBe(sampleDraft.message)
      expect(result.card.from).toBe('Alex')
      expect(result.card.messageFont).toBe('dancing-script')
    }
  })

  test('round-trips a draft with no messageFont, falling back to the template default', async () => {
    const payload = await encodeCard({ to: '', message: 'Hi', from: '' }, 'love-letter-01')
    const result = await decodeCardHash(`#/card/v2/${payload}`)
    expect(result?.ok).toBe(true)
    if (result?.ok) {
      expect(result.card.messageFont).toBe('satisfy')
    }
  })

  test('produces a shorter payload than the legacy verbose format for a typical message', async () => {
    const compactPayload = await encodeCard(sampleDraft, 'birthday-party-01')
    const legacyJson = JSON.stringify({
      v: 1,
      template: 'birthday-party-01',
      to: sampleDraft.to,
      message: sampleDraft.message,
      from: sampleDraft.from,
      messageFont: sampleDraft.messageFont,
    })
    const legacyPayload = btoa(legacyJson)
    expect(compactPayload.length).toBeLessThan(legacyPayload.length)
  })

  test('rejects a corrupted v2 payload as invalid instead of throwing', async () => {
    const result = await decodeCardHash('#/card/v2/not-a-valid-payload')
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  test('rejects an out-of-range template code as missing-template', async () => {
    const payload = await encodeCard(sampleDraft, 'not-a-real-template-id')
    const result = await decodeCardHash(`#/card/v2/${payload}`)
    expect(result).toEqual({ ok: false, reason: 'missing-template' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test codec.spec.ts`
Expected: FAIL — `decodeCardHash` still returns the old synchronous shape / `#/card/v2/` routing doesn't exist yet, so at minimum the round-trip tests fail (template/message/font come back wrong or the result is `null`).

- [ ] **Step 3: Replace `src/card/codec.ts` with the version below**

This adds the compact (v2) encode/decode path and the immutable template/font code registries, rewires `decodeCardHash` to route between the legacy and compact formats, and makes `encodeCard`/`createCardUrl` async so they always produce `#/card/v2/<payload>` links. `App.tsx` still calls these synchronously at this point, so it will show type errors after this step — that's expected, and fixed by Task 2 (`copyLink`/`shareCard`/the share-link field) and Task 3 (`sharedResult` routing). Replace the full file contents:

```ts
import { cardTemplates, type CardDraft } from '../data/templates'
import { messageFonts, type MessageFontId } from '../data/typography'

export const CARD_SCHEMA_VERSION = 1

export type EncodedCard = CardDraft & {
  v: typeof CARD_SCHEMA_VERSION
  template: string
  messageFont?: MessageFontId
}

export type DecodeResult =
  | { ok: true; card: EncodedCard }
  | { ok: false; reason: 'invalid' | 'unsupported' | 'missing-template' }

// Immutable, append-only — exactly like template IDs themselves (see
// README): a code's meaning can never change once a link using it has been
// shared. New templates/fonts are appended at the end, never inserted,
// reordered, or reused.
const TEMPLATE_CODES = [
  'birthday-confetti-01',
  'birthday-sunshine-01',
  'birthday-party-01',
  'thank-you-bloom-01',
  'thank-you-sincere-01',
  'congratulations-bright-01',
  'love-together-01',
  'love-letter-01',
  'just-because-doodle-01',
]

const FONT_CODES: MessageFontId[] = [
  'caveat',
  'dancing-script',
  'cormorant',
  'dm-serif',
  'libre-baskerville',
  'quicksand',
  'satisfy',
  'space-grotesk',
]

type CompactPayload = {
  t: number
  n: string
  m: string
  f: string
  mf?: number
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeCard(card: CardDraft, templateId: string): Promise<string> {
  const payload: CompactPayload = {
    t: TEMPLATE_CODES.indexOf(templateId),
    n: card.to.trim(),
    m: card.message.trim(),
    f: card.from.trim(),
    ...(card.messageFont ? { mf: FONT_CODES.indexOf(card.messageFont) } : {}),
  }
  const json = new TextEncoder().encode(JSON.stringify(payload))
  const compressed = await deflate(json)
  return bytesToBase64Url(compressed)
}

export async function createCardUrl(card: CardDraft, templateId: string): Promise<string> {
  const payload = await encodeCard(card, templateId)
  return `${window.location.origin}${window.location.pathname}#/card/v2/${payload}`
}

function decodeLegacyPayload(payload: string): DecodeResult {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payload))
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'invalid' }
    const candidate = parsed as Record<string, unknown>
    if (candidate.v !== CARD_SCHEMA_VERSION) return { ok: false, reason: 'unsupported' }
    if (typeof candidate.template !== 'string' || !cardTemplates.some(({ id }) => id === candidate.template)) {
      return { ok: false, reason: 'missing-template' }
    }
    if (typeof candidate.to !== 'string' || candidate.to.length > 60) return { ok: false, reason: 'invalid' }
    if (typeof candidate.message !== 'string' || candidate.message.length > 500) return { ok: false, reason: 'invalid' }
    if (typeof candidate.from !== 'string' || candidate.from.length > 60) return { ok: false, reason: 'invalid' }
    const template = cardTemplates.find(({ id }) => id === candidate.template)!
    const requestedFont = typeof candidate.messageFont === 'string' ? candidate.messageFont : undefined
    const messageFont = messageFonts.find(({ id }) => id === requestedFont)?.id
    return {
      ok: true,
      card: {
        v: CARD_SCHEMA_VERSION,
        template: candidate.template,
        to: candidate.to,
        message: candidate.message,
        from: candidate.from,
        messageFont: messageFont || template.typography.defaultMessageFont,
      },
    }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

async function decodeCompactPayload(payload: string): Promise<DecodeResult> {
  try {
    const compressed = base64UrlToBytes(payload)
    const json = new TextDecoder().decode(await inflate(compressed))
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'invalid' }
    const candidate = parsed as Record<string, unknown>
    const templateId = typeof candidate.t === 'number' ? TEMPLATE_CODES[candidate.t] : undefined
    const template = templateId ? cardTemplates.find(({ id }) => id === templateId) : undefined
    if (!templateId || !template) return { ok: false, reason: 'missing-template' }
    if (typeof candidate.n !== 'string' || candidate.n.length > 60) return { ok: false, reason: 'invalid' }
    if (typeof candidate.m !== 'string' || candidate.m.length > 500) return { ok: false, reason: 'invalid' }
    if (typeof candidate.f !== 'string' || candidate.f.length > 60) return { ok: false, reason: 'invalid' }
    const requestedFont = typeof candidate.mf === 'number' ? FONT_CODES[candidate.mf] : undefined
    const messageFont = messageFonts.find(({ id }) => id === requestedFont)?.id
    return {
      ok: true,
      card: {
        v: CARD_SCHEMA_VERSION,
        template: templateId,
        to: candidate.n,
        message: candidate.m,
        from: candidate.f,
        messageFont: messageFont || template.typography.defaultMessageFont,
      },
    }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export type HashRoute =
  | { kind: 'none' }
  | { kind: 'legacy'; result: DecodeResult }
  | { kind: 'compact'; payload: string }

export function routeCardHash(hash: string): HashRoute {
  const legacyMatch = hash.match(/^#\/card\/([^/?#]+)$/)
  if (legacyMatch) return { kind: 'legacy', result: decodeLegacyPayload(legacyMatch[1]) }
  const compactMatch = hash.match(/^#\/card\/v2\/([^/?#]+)$/)
  if (compactMatch) return { kind: 'compact', payload: compactMatch[1] }
  return { kind: 'none' }
}

export async function decodeCardHash(hash: string): Promise<DecodeResult | null> {
  const route = routeCardHash(hash)
  if (route.kind === 'none') return null
  if (route.kind === 'legacy') return route.result
  return decodeCompactPayload(route.payload)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test codec.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (`App.tsx` will now show type errors because `decodeCardHash`/`createCardUrl`/`encodeCard` are `async` but called synchronously — that's expected and fixed in Tasks 4–5. Confirm the *only* errors are in `src/App.tsx`, not `src/card/codec.ts`.)

- [ ] **Step 6: Commit**

```bash
git add src/card/codec.ts tests/e2e/codec.spec.ts
git commit -m "$(cat <<'EOF'
feat: add compact v2 card payload codec

Short JSON keys + native deflate-raw compression shrink the share
link substantially (see docs/superpowers/specs/2026-09-12-compact-share-link-design.md).
Legacy #/card/<payload> links keep decoding unchanged via routeCardHash.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire `App.tsx`'s live share-link field to the async codec

**Files:**
- Modify: `src/App.tsx:129-169`

The "Share link" input currently reads a synchronously-computed `currentUrl` (`App.tsx:169`) and `copyLink`/`shareCard` (`App.tsx:129-154`) call `createCardUrl` synchronously. All three now need the `async` codec from Task 1.

- [ ] **Step 1: Replace the `currentUrl` computation and `copyLink`/`shareCard` with async-safe versions**

Replace lines 129–169 of `src/App.tsx` (the `copyLink`, `shareCard` functions and the `currentUrl` constant) with:

```tsx
  async function copyLink() {
    const url = await createCardUrl(draft, selectedTemplate.id)
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
    const url = await createCardUrl(draft, selectedTemplate.id)
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
```

Then, near the other `useState`/`useRef` declarations at the top of the component (after the existing `hasShownSupportPanelRef` on line 24), add:

```tsx
  const [shareUrl, setShareUrl] = useState('')
  const shareUrlGenerationRef = useRef(0)
```

And add a new `useEffect` (placed after the existing hash-change `useEffect`, i.e. after line 36) that recomputes `shareUrl` whenever the draft or template changes, discarding stale results:

```tsx
  useEffect(() => {
    const generation = ++shareUrlGenerationRef.current
    createCardUrl(draft, selectedTemplate.id).then((url) => {
      if (shareUrlGenerationRef.current === generation) setShareUrl(url)
    })
  }, [draft, selectedTemplate.id])
```

Finally, find the "Share link" input further down in the JSX (it currently reads `value={currentUrl}`, around the `share-link-field` label) and the status paragraph that reads `` `Your share link is ready: ${currentUrl}` `` — replace both `currentUrl` references with `shareUrl`.

- [ ] **Step 2: Update imports**

`src/App.tsx:2` already imports `decodeCardHash, createCardUrl, encodeCard` — `encodeCard` is no longer called directly from `App.tsx` (only `createCardUrl` is), and this project has `noUnusedLocals: true` in `tsconfig.app.json`, so an unused import is a typecheck failure, not just a lint warning. Change line 2 to:

```tsx
import { decodeCardHash, createCardUrl, type DecodeResult } from './card/codec'
```

(`routeCardHash` isn't imported yet — it's added in Task 3, the first task that actually uses it, to avoid an unused-import typecheck failure in this task.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: remaining errors should only be about `decodeCardHash`'s initial synchronous call at `App.tsx:17` (`Type 'Promise<DecodeResult | null>' is not assignable to type 'DecodeResult | null | undefined'`) and the `hashchange` handler at `App.tsx:33` with the same mismatch — both fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat: make the live share-link field async-safe

createCardUrl is now async (native compression). The share-link input
recomputes via a useEffect guarded by a generation counter so a fast
typist never sees a stale URL overwrite a newer one.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire `App.tsx`'s shared-card routing (mount + hashchange) to the async codec

**Files:**
- Modify: `src/App.tsx:16-38` (state setup and hash-change effect)
- Modify: `src/App.tsx:38-101` (add a loading branch before the existing `ok`/error branches)

The trickiest part: `decodeCardHash` is now `async`, but the initial `useState(() => decodeCardHash(window.location.hash))` call needs a value *synchronously* on first render. Reusing the compression path only when actually needed (legacy links and non-card visits stay perfectly synchronous, matching today's behavior exactly) avoids a flash of the editor UI before a shared card appears.

- [ ] **Step 1: Update imports**

`src/App.tsx:2` currently reads `import { decodeCardHash, createCardUrl, type DecodeResult } from './card/codec'` (from Task 2). Add `routeCardHash`, used by this task:

```tsx
import { decodeCardHash, createCardUrl, routeCardHash, type DecodeResult } from './card/codec'
```

- [ ] **Step 2: Replace the `sharedResult` state, effect, and add a generation ref**

Replace lines 17 and 32–36 of `src/App.tsx`:

```tsx
  const [sharedResult, setSharedResult] = useState<DecodeResult | null | undefined>(() => decodeCardHash(window.location.hash))
```

and

```tsx
  useEffect(() => {
    const handleHashChange = () => setSharedResult(decodeCardHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])
```

with:

```tsx
  const [sharedResult, setSharedResult] = useState<DecodeResult | null | undefined>(() => {
    const route = routeCardHash(window.location.hash)
    if (route.kind === 'none') return null
    if (route.kind === 'legacy') return route.result
    return undefined // compact (v2) link: decode is async, see the effect below
  })
  const sharedDecodeGenerationRef = useRef(0)

  useEffect(() => {
    const handleHashChange = () => {
      const route = routeCardHash(window.location.hash)
      if (route.kind === 'none') return setSharedResult(null)
      if (route.kind === 'legacy') return setSharedResult(route.result)
      setSharedResult(undefined)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (sharedResult !== undefined) return
    const generation = ++sharedDecodeGenerationRef.current
    decodeCardHash(window.location.hash).then((result) => {
      if (sharedDecodeGenerationRef.current === generation) setSharedResult(result)
    })
  }, [sharedResult])
```

(`sharedResult === undefined` means "a compact link is pending decode": set directly by the initializer on first mount, and re-armed by `handleHashChange` whenever the hash changes to a new compact link. The second effect does the actual async decode and only applies its result if nothing newer has superseded it.)

- [ ] **Step 3: Add a loading view for the pending state**

Immediately before the existing `if (sharedResult?.ok) {` branch (`App.tsx:38`), add:

```tsx
  if (sharedResult === undefined) {
    return (
      <div className="app-shell shared-shell">
        <header className="site-header">
          <a className="brand" href="#/" aria-label="Little Hello home">
            <span className="brand-mark" aria-hidden="true">✦</span><span>Little Hello</span>
          </a>
        </header>
        <main className="shared-main" aria-busy="true">
          <p className="eyebrow">Opening your card…</p>
        </main>
      </div>
    )
  }
```

This reuses existing classes only (`shared-shell`, `shared-main`, `eyebrow`) — no new CSS.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the app, create a card, click Share/copy the link, open it in a new tab. Confirm the card renders (not the loading text, not the editor) and the link contains `#/card/v2/`. Also visit a URL with a garbage hash (`/#/card/v2/garbage`) and confirm the existing "We couldn't open this card" view appears.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat: decode v2 share links asynchronously without flashing the editor

Hash routing is now synchronous (routeCardHash) and only the actual
compact-payload decompression is async, so plain editor visits and
legacy v1 links render exactly as before with zero delay. A shared v2
link briefly shows an "Opening your card…" state instead of the full
editor while its payload decompresses.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Update Playwright e2e coverage for the new link format

**Files:**
- Modify: `tests/e2e/smoke.spec.ts:72-87` (share URL test)
- Modify: `tests/e2e/smoke.spec.ts:139-156` (font-preservation test)
- Modify: `tests/e2e/smoke.spec.ts:89-93` (malformed URL test — add a v2 variant alongside it)

The existing tests read `shareLink.inputValue()` immediately after filling fields. Since the share link now populates asynchronously, reads must wait for it via `expect(locator).toHaveValue(...)` (which auto-retries) before calling `.inputValue()`.

- [ ] **Step 1: Update the share-URL test**

Replace the `'generates a share URL and opens the shared card view'` test (`tests/e2e/smoke.spec.ts:72-87`) with:

```ts
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
```

- [ ] **Step 2: Add a legacy-link regression test right after it**

Capture one real v1 URL by temporarily running the *current* (pre-change) app, or construct it directly — since this is a fixed historical format, hardcode it. Add this test immediately after the one from Step 1:

```ts
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
```

- [ ] **Step 3: Add a malformed-v2 test right after the existing malformed-v1 test**

Immediately after `'handles malformed shared URLs without crashing'` (`tests/e2e/smoke.spec.ts:89-93`), add:

```ts
test('handles malformed v2 shared URLs without crashing', async ({ page }) => {
  await page.goto('/#/card/v2/not-a-valid-payload')
  await expect(page.getByRole('heading', { name: 'We couldn’t open this card.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Your Own Card' })).toBeVisible()
})
```

- [ ] **Step 4: Update the font-preservation test's share-link read**

In `'applies an expressive message font and preserves it in shared cards'` (`tests/e2e/smoke.spec.ts:139-156`), replace:

```ts
  const url = await page.getByRole('textbox', { name: 'Share link' }).inputValue()
```

with:

```ts
  const shareLink = page.getByRole('textbox', { name: 'Share link' })
  await expect(shareLink).toHaveValue(/#\/card\/v2\//)
  const url = await shareLink.inputValue()
```

- [ ] **Step 5: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all tests pass, including the two new ones and the four modified ones.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
test: cover v2 share links, legacy link compatibility, and malformed v2 payloads

Share-link reads now wait for the async URL via toHaveValue instead of
reading inputValue() immediately, since link generation is no longer
synchronous.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Pure-logic + e2e tests**

Run: `npm test`
Expected: all tests pass (this repo's `test` script is the same as `test:e2e`, running the full Playwright suite including `codec.spec.ts`, `support.spec.ts`, and `smoke.spec.ts`).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: builds cleanly with no TypeScript errors.

- [ ] **Step 5: Manual check on a real mobile-width viewport**

Run: `npm run dev`, open the app in a browser resized to ~375px width. Create a card, confirm the share link looks meaningfully shorter than before, copy it, paste it in a new tab, confirm the card opens correctly with no layout regressions.

- [ ] **Step 6: Update project status doc**

`docs/AI-PROJECT-STATUS.md` currently lists "Versioned, validated card URLs in the hash" under Current functionality. Update that line to:

```
- Versioned, validated card URLs in the hash (compact v2 format with
  native deflate compression; legacy v1 links still decode)
```

- [ ] **Step 7: Commit**

```bash
git add docs/AI-PROJECT-STATUS.md
git commit -m "$(cat <<'EOF'
docs: note the compact v2 share-link format in project status

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
