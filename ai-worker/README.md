# Little Hello: AI Worker

Backend for the optional "Create with AI" feature. Design and privacy boundary:
`docs/superpowers/specs/2026-11-08-ai-card-generation-design.md`.

It's a separate Cloudflare Worker, like the sent-counter Worker in `worker/`.
It holds no card content. Its only storage is one Durable Object
(`QuotaGuard`) holding a per-UTC-day Neuron total and per-visitor counts keyed
by a hashed IP. Records from earlier days are deleted by a daily alarm.

**Status (Milestone 3):** text generation has been run against real Workers
AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) through `wrangler dev`, the
prompt tuned, and the cost measured: about 30 Neurons per message. The Worker
hasn't been deployed yet, and there's no frontend until Milestone 4.

## Cost safety

- Runs on the **Workers Free** plan. There, usage past the 10,000 Neurons/day
  free allocation fails with an error instead of billing. **Don't upgrade the
  account to Workers Paid without revisiting this design.**
- `QuotaGuard` stops at `BUDGET_FRACTION` x `DAILY_NEURON_ALLOWANCE` (8,000 by
  default). It reserves a worst-case estimate *before* each AI call and
  corrects it from the reported token usage afterwards.
- The allocation is account-wide. Other Workers AI use on the same account
  isn't seen by this counter.
- Kill switch: set `AI_ENABLED` to `"false"` in `wrangler.toml` and redeploy.
  Every generate request is then refused before Turnstile or AI.

## One-time setup

1. `npm install`
2. `npx wrangler login`
3. Create a Turnstile widget in the Cloudflare dashboard (Turnstile → Add
   widget) for `little-hello.ns-apps.workers.dev` and `santosn-qa.github.io`.
4. `npx wrangler secret put TURNSTILE_SECRET_KEY` (the widget's secret key)
5. `npx wrangler secret put IP_HASH_SECRET` (any strong random value, e.g.
   `openssl rand -hex 32`)
6. Check `ALLOWED_ORIGINS` and `TURNSTILE_EXPECTED_HOSTNAMES` in `wrangler.toml`.

## Deploy

`npm run deploy` prints the Worker URL. Production builds come from Cloudflare
Workers Builds, so set these as **build variables in the Cloudflare dashboard**
(Workers & Pages → `little-hello` → Settings → Build), not as GitHub variables:

- `VITE_AI_API_URL`: the Worker URL, with no trailing slash
- `VITE_TURNSTILE_SITE_KEY`: the widget's site key

Leaving `VITE_AI_API_URL` unset keeps the feature completely hidden.

## Tests

The logic is tested in Node with the main repo's Playwright runner. No
Cloudflare account or AI calls are needed:

```bash
# from the repo root
npx playwright test aiWorker.spec.ts
# type check this Worker
cd ai-worker && npm run typecheck
```

## Local check against real Workers AI

`npx wrangler login`, then `npm run dev`. The `AI` binding always calls
Cloudflare, even in local dev, so these calls **use the account's free daily
Neurons** (about 30 each). Quota state stays local. Each call logs
`generate/message usage` with token counts and Neurons, never content.

## Local smoke check (no AI calls)

`wrangler dev` always needs a remote Cloudflare connection for the `AI`
binding. To check the Durable Object and routing locally without any AI
call, run with a copy of `wrangler.toml` that omits the `[ai]` block.
Generation then fails safely with `generation_failed` after one retry, which
also exercises reserve, settle and the retry against the real Durable Object
runtime.

Create `ai-worker/.dev.vars` (git-ignored, never commit it):

```
IP_HASH_SECRET=local-dev-secret-change-me
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:4173
TURNSTILE_EXPECTED_HOSTNAMES=
```

`1x…AA` is Cloudflare's always-pass Turnstile test secret, which accepts any
token. `2x0000000000000000000000000000000AA` always fails. The test secret
reports hostname `example.com`, which is why `TURNSTILE_EXPECTED_HOSTNAMES`
is blank locally.

```bash
curl -H 'Origin: http://localhost:5173' http://localhost:8787/v1/status
curl -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"turnstileToken":"XXXX.DUMMY.TOKEN.XXXX","occasion":"Love","recipient":"partner","tone":"romantic","style":"watercolor","personalMessage":"Every day with you is my favourite day."}' \
  http://localhost:8787/v1/generate/message
```
