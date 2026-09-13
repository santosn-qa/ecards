# Public "Sent Counter" — Design

## Goal

Show a single, warm, encouraging public number — e.g. "💌 1,234 Little Hellos
sent so far" — so visitors can see the app is being used and existing users
feel encouraged to keep sending cards. This is a narrow, explicit exception to
the project's "no backend, no database, no analytics, no tracking" principle
(see `README.md`), scoped as tightly as possible: one anonymous integer, no
per-user data, no card content, ever.

Offline usage can never be counted — that's an accepted, permanent limitation,
not a bug. The counter only reflects actions that succeed while online.

## What is counted

One counter, "sent." It increments by exactly 1 each time any of the
following succeeds:

- **Share Card** (`navigator.share` completes without the user cancelling)
- **Copy Link** (clipboard write succeeds)
- **Download Card** (PNG export succeeds)

There is no per-action breakdown, no per-card dedup, and no distinction
between the three triggers. If a person shares and then also downloads the
same card, that's 2 — this is an approximate, feel-good tally, not an
analytics metric, and is documented as such.

"Created" as a separate concept was considered and rejected: there is no
single explicit "create" step in the editor (a card only becomes a concrete
artifact when one of the three actions above succeeds), so a separate
"created" number would just duplicate this one.

## Privacy boundary (must hold for every request, not just typical ones)

The increment request never contains and the Worker never stores:

- card message, recipient/sender names, template/occasion choice, or any
  other card content
- cookies, device/browser identifiers, or anything tied to a person across
  requests
- IP addresses persisted beyond the lifetime of a short-lived,
  automatically-expiring debounce key (see Abuse handling below) — that key
  itself never leaves the Worker and is never readable back out

The Worker's KV store holds exactly one meaningful value: a single integer
counter.

## Backend: Cloudflare Worker + KV

New top-level `worker/` directory, deployed and versioned independently of
the Vite app (not part of `npm run build`):

- `worker/src/index.ts` — the Worker.
- `worker/wrangler.toml` — binds a KV namespace `COUNTER_KV`.
- `worker/package.json` — its own `wrangler` devDependency and deploy script.
- `worker/README.md` — setup/deploy instructions (create the KV namespace,
  `wrangler deploy`, configure allowed origins).

Endpoints:

- `GET /count` → `{ "count": number }`. Reads the current value (defaults to
  `0` if the key doesn't exist yet). No side effects.
- `POST /increment` → atomically increments the KV value by 1, returns the
  new `{ "count": number }`. Empty request body; the Worker ignores any body
  content it's sent.

CORS: the Worker only sets `Access-Control-Allow-Origin` for a fixed
allowlist (the production domain and the GitHub Pages URL), configured as a
constant in `worker/src/index.ts`. Requests from other origins get no CORS
header and the browser blocks the response client-side.

### Abuse handling (deliberately minimal)

This is a public feel-good number, not an audited metric, so the bar is "stop
accidental double-counts," not "prevent all fraud":

- On `POST /increment`, the Worker computes a short-lived KV key from the
  request's `CF-Connecting-IP` (a truncated SHA-256 hash) with a **60-second
  TTL** — Cloudflare KV enforces a hard 60-second minimum on `expirationTtl`,
  so that's the shortest debounce window the platform allows. If that key
  already exists, the Worker returns the current count *without*
  incrementing (still a `200`, so the client doesn't need special handling).
  If it doesn't exist, the Worker sets it (TTL 60s) and increments normally.
  This means at most one increment per IP per minute — generous enough that a
  legitimate person sharing and then downloading the same card within a
  minute will only be counted once, which is an acceptable trade-off for a
  feel-good number, not a precise one.
- This key is never logged, never exposed via any endpoint, and expires on
  its own — it exists purely to collapse rapid double-fires (double clicks,
  retries), not to build any kind of visitor record.
- No further rate limiting, CAPTCHA, or fraud detection is in scope. A
  determined script can still inflate the number; that's an accepted
  limitation, called out in `worker/README.md`.

## Client: config, logic, and UI

Mirrors the existing `support.ts` / `supportPrompt.ts` / component split
used by the Ko-fi feature.

- **`src/config/counter.ts`**
  ```ts
  export const COUNTER_CONFIG = {
    apiUrl: import.meta.env.VITE_COUNTER_API_URL as string | undefined,
  }
  ```
  When `VITE_COUNTER_API_URL` is unset (local dev, forks, PR previews that
  don't set the env var), the feature is fully inert: no requests are made,
  no UI renders. This makes the feature opt-in per-deployment with zero code
  changes needed for contributors/forks.

- **`src/counter/sentCounter.ts`** — pure fetch wrapper, no DOM/component
  concerns:
  - `fetchSentCount(): Promise<number | null>` — `GET` the count. Returns
    `null` on any failure (offline, blocked, non-2xx, endpoint unset,
    malformed JSON) — never throws.
  - `incrementSentCounter(): void` — fire-and-forget `POST`. Explicitly not
    awaited by callers; all errors are caught and swallowed internally. No
    return value, since nothing should ever branch on whether this
    succeeded.
  - Both functions no-op immediately (return `null` / do nothing) when
    `COUNTER_CONFIG.apiUrl` is unset.

- **`src/components/SentCounter.tsx`** — the tagline itself:
  - On mount, calls `fetchSentCount()`. Renders nothing while loading and
    nothing on `null` (no skeleton, no error state — it either shows a real
    number or doesn't visually exist).
  - Renders e.g. `💌 {count.toLocaleString()} Little Hellos sent so far`
    once a number is available.
  - Exposes a small imperative handle / prop (`onSent` callback pattern, or
    a bump function returned from a `useSentCounter()` hook) so `App.tsx` can
    optimistically increment the displayed number by 1 immediately after a
    successful send action, without waiting for the network.

- **Placement in `App.tsx`**: inside the existing `.hero-copy` block in the
  hero section, directly after the existing `hero-text` paragraph and before
  `occasion-title` — visible immediately on load, close to the occasion
  picker, before any editing has happened.

- **Wiring to actions**: `incrementSentCounter()` (plus the optimistic bump)
  is called from the existing success paths already in `App.tsx`:
  - end of `copyLink()`, right after `setNotice('Link copied!')`
  - end of `shareCard()`, right after the `navigator.share` success branch's
    `setNotice('Ready to share!')` (not on the catch/cancel branch, and not
    on the `copyLink` fallback branch twice — the fallback already calls
    `copyLink`, which will bump it once)
  - end of `exportCard()`, right after `setNotice('Card downloaded!')`

  This reuses the exact same "did this actually succeed" boundaries already
  established for `maybeShowSupportPanel()`, which sits right next to each of
  these call sites.

## Rollout / kill switch

Leaving `VITE_COUNTER_API_URL` unset in any build fully disables the feature:
no network calls, no UI, no visual trace. Setting it re-enables everything
with no other code changes. This satisfies the project's existing
feature-flag convention (same shape as `SUPPORT_CONFIG.enabled`).

## Testing

- **`worker/`**: a minimal manual test plan in `worker/README.md` (curl
  examples for `GET /count` and `POST /increment`, verifying the debounce).
  The Worker is a small, independent unit; it does not need Playwright
  coverage in the main app's suite.
- **Main app**, new `tests/e2e/sent-counter.spec.ts`:
  - **Pure logic** (`sentCounter.ts`), run against a mocked `fetch`:
    - `fetchSentCount` returns the parsed count on a 200 JSON response.
    - Returns `null` on network failure, non-2xx, and malformed JSON.
    - Returns `null` immediately (no fetch call at all) when
      `COUNTER_CONFIG.apiUrl` is unset.
    - `incrementSentCounter` fires a `POST` to the configured URL and never
      throws, including when the mocked fetch rejects.
  - **Browser-driven**, with the counter endpoint mocked via Playwright route
    interception:
    - Tagline renders the fetched count on load.
    - Tagline bumps by 1 immediately after a successful Copy Link, Share
      Card, and Download Card action (three cases).
    - Tagline does not appear, and no request is attempted, when
      `VITE_COUNTER_API_URL` is unset for the test build.
    - When the mocked endpoint is aborted/unreachable, the app behaves
      identically to today (no crash, no console errors, no visible error
      state) and simply omits the tagline.
  - **Regression**: existing suite (`smoke.spec.ts`, support/share/download
    tests) continues to pass unmodified — this feature is additive and
    isolated to its own module and one render location.

## Out of scope (for this iteration)

- Per-action breakdown (created/downloaded/shared shown separately).
- Any real anti-fraud/rate-limiting beyond the 2-second debounce.
- Any dashboard, historical trend, or time-series view of the count.
- Counting anything that happens while offline.
- Any third-party analytics service (Plausible, GA, etc.) — this stays a
  single bespoke integer, not a general analytics integration.
