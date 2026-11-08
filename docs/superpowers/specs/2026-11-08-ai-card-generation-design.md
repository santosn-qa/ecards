# "Create with AI": Design

Status: draft for approval (2026-11-08). Decisions already approved by the
owner: Cloudflare **Workers Free** plan; opt-in privacy exception; Creative-mode
images appear in downloads only; no new title field; Turnstile loads lazily.

## Goal

An optional way to make a card from a short description. The AI suggests
content (the message, plus a choice of existing template and font) and, in
Creative mode, an illustration. **The existing renderer, editor, PNG export
and share-link codec stay in charge of the card.** If the AI is disabled,
over budget, offline or failing, the app works exactly as it does today.

## Non-goals

- No accounts, no stored cards, no paid fallback, no Workers Paid upgrade.
- No new share-link fields. The v2 codec is unchanged.
- No AI-generated HTML, SVG or markup is ever rendered.
- No new occasions. AI cards use the 5 existing occasions, because every card
  must land on a real template. Adding occasions needs new artwork first.

## Privacy boundary (a second, scoped exception to "no backend")

Like the sent counter (`2026-09-13-sent-counter-design.md`), this is a
deliberate, narrow exception.

- **Nothing is sent until the user presses Generate** inside the "Create with
  AI" panel. Opening the page sends no AI traffic. Opening the panel makes one
  `GET /v1/status` request and loads the Turnstile script.
- **Sent:** occasion, recipient type, tone, visual style (all allow-listed
  enums) and the optional personal message and extra instructions (bounded
  free text). **The To and From names are never sent.** The message addresses
  the recipient generically, and the card's existing To/From fields carry the
  names.
- The Worker **does not store or log** request or response content. Logs hold
  error codes only.
- The quota store holds: one global per-UTC-day Neuron total, and per-visitor
  counts keyed by `HMAC(IP, secret)` and the UTC day. Keys from earlier days are
  deleted by a daily alarm.
- Content is processed by Cloudflare Workers AI. UI copy next to the Generate
  button says so: *"Your choices and message are sent to Cloudflare's AI to
  write your card. Little Hello doesn't store them."* The "Made privately on
  your device" label stays true for every non-AI card.

## Architecture

```
Browser (Create with AI panel)
  → ai-worker (new, separate Worker like worker/)
      CORS allow-list → body ≤ 8 KB → schema validation → kill switch
      → Turnstile siteverify → QuotaGuard DO reserve()
      → Workers AI (env.AI) with timeout → output validation
      → (≤ 1 controlled retry) → QuotaGuard settle() → JSON response
  → App applies {message, templateId, messageFont} to the existing draft
  → existing CardRenderer / downloadCardPng / codec
```

- **Separate Worker** (`ai-worker/`). The production site is deployed by Cloudflare
  Workers Builds with no root wrangler config, so the site deploy stays
  untouched.
- **Feature flag:** the panel exists only when `VITE_AI_API_URL` is set at build
  time (Workers Builds dashboard setting for production). Unset means no UI and
  no requests, the same as the counter.
- **Server kill switch:** `AI_ENABLED = "false"` in the Worker vars makes every
  generate call return `ai_disabled` without touching Turnstile or AI.

## Provider

- **Text:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. It's on Cloudflare's
  JSON-mode list, returns a `usage` object, and is free-allocation (not one of
  the paid-only models). Quality is preferred over speed. Called with
  `messages`, `response_format: { type: "json_schema", ... }`, `max_tokens: 250`,
  `temperature: 0.8`. JSON mode is not guaranteed, so output is always
  validated (below).
- **Image (Creative, Milestone 5):** `@cf/black-forest-labs/flux-1-schnell`,
  4 steps, prompt built server-side only.
- The provider sits behind a `TextProvider` / `ImageProvider` interface, so
  swapping it never touches the renderer.
- **Neuron accounting** uses the published per-model rates (pricing page,
  updated 2026-10-20): 70B text is 26,668 per M input and 204,805 per M output
  tokens. flux-1-schnell is 4.8 per 512×512 tile plus 9.6 per step. Text cost
  is computed from the returned `usage`; image cost from output dimensions.
  Rates live in one config table.
- **Measured cost (Milestone 3, 2026-11-08):** 22 real calls with the final
  prompt took 564–641 prompt tokens and 47–85 output tokens, which is **26–34
  Neurons per message (about 30 on average)**. At the 8,000 cap that's roughly
  260 AI messages a day across all visitors, before retries. Latency was
  2–4.7 s, with one outlier at 11.5 s, inside the 20 s timeout. No output
  failed validation, so no retries were needed.

## Budget and quotas

Enforced in one SQLite-backed Durable Object, `QuotaGuard` (free on Workers
Free), addressed by a single fixed name, so every request worldwide goes
through the same counter. A Durable Object processes one event at a time, so
read-modify-write is safe.

| Setting (Worker var) | Default | Notes |
|---|---|---|
| `DAILY_NEURON_ALLOWANCE` | 10000 | Cloudflare free allocation |
| `BUDGET_FRACTION` | 0.8 | stop at 8,000 Neurons |
| `SIGNATURE_PER_VISITOR_PER_DAY` | 3 | |
| `CREATIVE_PER_VISITOR_PER_DAY` | 1 | |
| `VISITOR_COOLDOWN_SECONDS` | 20 | between any two generations |
| `TEXT_RESERVE_NEURONS` | 80 | covers the worst case (~650 prompt + 250 output tokens ≈ 68) |
| `IMAGE_RESERVE_NEURONS` | 150 | worst-case pre-reservation |

Flow:

1. `reserve(visitor, mode)` runs **before** any AI call. It refuses with
   `rate_limited` (cooldown), `daily_limit_reached` (visitor) or
   `budget_exhausted` (global spend plus reserve over the cap). Otherwise it
   counts the visitor's use and adds the reserve to the global total.
2. After the call, `settle(reservationId, actualNeurons)` corrects the global
   total. If usage is unknown (timeout or error), the full reserve stays
   counted, which is conservative.
3. A **retry** (at most one per user action) takes a new global reservation but
   does not count as another visitor use.
4. Day boundary is 00:00 UTC, matching Cloudflare's reset.

The 10,000 allocation is **account-wide**, so other Workers AI use on the same
account isn't seen by this counter. The 20% margin covers that. Because the
account is on Workers Free, going over the allocation makes calls fail instead
of billing, so the hard ceiling holds even if this counter is wrong.

**Visitor identity** is the HMAC of `CF-Connecting-IP`. Shared IPs (offices,
mobile carriers) share a quota, and IPv6 rotation can get around it.
Turnstile and the global cap bound the damage. This is accepted.

## API

All responses are JSON. Errors are `{ "error": <code>, "retryAfterSeconds"? }`.

### `GET /v1/status`

`{ "enabled": bool, "signatureRemaining": n, "creativeRemaining": n }`. No
Turnstile. The panel calls it once when opened, to hide or explain the feature
up front.

### `POST /v1/generate/message`

```json
{
  "turnstileToken": "...",
  "occasion": "Birthday",
  "recipient": "friend",
  "tone": "playful",
  "style": "whimsical",
  "personalMessage": "",
  "extraInstructions": ""
}
```

- `occasion`: one of the 5 existing occasions.
- `recipient`: one of `friend`, `family`, `partner`, `colleague`, `someone`.
- `tone`: one of `sweet`, `funny`, `heartfelt`, `playful`, `encouraging`,
  `romantic`, `formal`.
- `style`: one of `watercolor`, `minimalist`, `pastel`, `hand-drawn`, `floral`,
  `whimsical`, `elegant`. In Signature mode this only guides which existing
  template is chosen.
- `personalMessage`: 0–500 characters, the app's existing limit.
- `extraInstructions`: 0–200 characters.

Success:

```json
{ "message": "...", "templateId": "birthday-party-01", "messageFont": "dancing-script", "source": "ai" }
```

- If `personalMessage` is non-empty, it is **returned verbatim** and **no AI
  call is made**. Template and font are picked deterministically from
  tone and style. `source` is `"user"`. This costs nothing and never rewrites
  the user's words.
- "Regenerate message" is the same request. The client keeps the user's
  current template and font if they changed them.

### `POST /v1/generate/illustration` (Milestone 5)

Request: `turnstileToken`, `occasion`, `style`. **No free text goes into image
prompts**, to keep image content safe. Response: `{ image: <base64 JPEG>,
width, height }`. The worker validates JPEG magic bytes, decoded size of at
most 1.5 MB, dimensions of at least 512 px and a supported aspect ratio, and
that the image isn't empty. The image appears in the preview and the PNG
download only. The share link uses the chosen curated template, and the UI
says so before generating.

| Code | HTTP | Meaning |
|---|---|---|
| `invalid_request` | 400 | schema, enum or length failure, or body too large |
| `forbidden_origin` | 403 | Origin not on the allow-list |
| `verification_failed` | 403 | Turnstile rejected the token, or its hostname didn't match |
| `verification_unavailable` | 503 | siteverify unreachable, timed out, or the secret is missing |
| `rate_limited` | 429 | cooldown, with `retryAfterSeconds` |
| `daily_limit_reached` | 429 | visitor's daily quota used up |
| `budget_exhausted` | 503 | global cap reached for today |
| `ai_disabled` | 503 | kill switch on |
| `generation_failed` | 502 | AI error, timeout, or invalid output after the retry |

## Output validation (deterministic, no second AI call)

The model must return `{ "message": string, "templateId": string,
"messageFont": string }`. The response may be a string (JSON-parsed) or
already an object, and both are handled. Rules:

- `message`: trimmed, whitespace collapsed (as the renderer does), and one
  pair of quotes wrapping the whole message removed, leaving 40–500 characters.
- Rejected if it contains:
  - HTML or XML tags (`<…>`), URLs or bare domains
  - markdown (`**`, `__`, leading `#` or list bullets, backticks)
  - control characters
  - placeholders (`[Name]`, `{name}`)
  - assistant meta-talk ("As an AI", a leading "Here is" or "Sure", refusals
    like "I can't help"). Ordinary phrasing such as "I cannot wait" is allowed.
- `templateId` must be one of the chosen occasion's templates, and
  `messageFont` one of the 8 font IDs. **If either is invalid, it is replaced
  by the deterministic choice.** It is not a failure.
- An invalid `message` triggers the single retry. A second failure returns
  `generation_failed`, and the UI offers the existing sample messages.

## Timeouts and retries

- `env.AI.run` takes an `AbortSignal` (per `@cloudflare/workers-types`).
  Timeouts are 20 s for text and 40 s for images.
- Turnstile siteverify times out after 5 s.
- At most one retry per user action, server-side only. The client never
  retries automatically.

## Turnstile

- Explicit rendering, script
  `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`,
  injected only when the panel opens.
- The token is single-use and expires after 300 s, so the widget is reset
  after every Generate.
- Server: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with
  `secret`, `response` and `remoteip`. When `TURNSTILE_EXPECTED_HOSTNAMES` is
  set, it also checks `hostname`. It's left unset in tests, because the test
  secret always reports `example.com`.
- Tests use Cloudflare's documented test keys. Secret
  `1x0000000000000000000000000000000AA` always passes, and
  `2x0000000000000000000000000000000AA` always fails.

## Frontend (Milestone 4)

- A "✦ Create with AI" button in the hero opens a panel above step 01. It has
  selects for occasion, recipient, tone and look, an optional "Anything to
  include?" field, an optional "Your own words" field (collapsed), the privacy
  note, a Turnstile widget, and "Write my card". Files:
  `src/components/AiCreatePanel.tsx`, `src/ai/aiClient.ts`,
  `src/ai/turnstile.ts`, `src/config/ai.ts`.
- Opening the panel makes one `GET /v1/status` request and loads the Turnstile
  script (`appearance: interaction-only`). Closing it removes the widget.
  Nothing loads on page load.
- Generate shows a busy state with Cancel (an `AbortController`). Every
  Turnstile token is used once, and the widget is reset after each request.
  The browser never retries automatically.
- On success, the panel fills the **existing** editor: occasion, template,
  message and font. A "✦ Written with AI help" note appears above the message,
  and the message is protected from accidental replacement by sample chips. The
  editor scrolls into view. "Regenerate message" replaces only the message
  and keeps whatever design and font the user has picked since.
- Every response is re-checked in the browser (`parseSuggestion`): the
  template must belong to the requested occasion, the font must be known, and
  the message 1–500 characters. React renders it as text, never HTML.
- Hidden entirely unless both `VITE_AI_API_URL` and `VITE_TURNSTILE_SITE_KEY`
  are set. Disabled with an explanation when offline, `enabled: false`, or the
  visitor's quota is used up. "Your own words" still works then, since it costs
  no AI.
- **Service worker (verified):** the generated `sw.js` registers only the
  app-shell navigation route, and its precache list holds only local assets,
  so `/v1/*` responses and the Turnstile script are never cached.

## Testing

No new test dependencies. Worker logic lives in pure modules (validation,
prompt building, quota rules over a small storage interface, Turnstile
verification with an injected `fetch`, and a router with injected providers).
These are tested with the existing Playwright runner in Node
(`tests/e2e/aiWorker.spec.ts`), the same way `codec.spec.ts` already is.
The Durable Object is a thin adapter over the tested quota logic and is
checked manually with `wrangler dev`. The `AI` binding always needs a remote
Cloudflare connection, even in local dev, so the local smoke check uses a
temporary config without it (see `ai-worker/README.md`).
Frontend journeys (Milestone 4) mock the Worker with Playwright request
interception.

## Configuration summary

| Where | Name | Kind |
|---|---|---|
| ai-worker | `IP_HASH_SECRET` | secret |
| ai-worker | `TURNSTILE_SECRET_KEY` | secret |
| ai-worker | `ALLOWED_ORIGINS` | var (comma-separated) |
| ai-worker | `TURNSTILE_EXPECTED_HOSTNAMES` | var (optional) |
| ai-worker | `AI_ENABLED` and the budget/quota vars | var |
| Workers Builds (site) | `VITE_AI_API_URL`, `VITE_TURNSTILE_SITE_KEY` | build vars |
