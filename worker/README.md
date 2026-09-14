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
6. Set the production IP-hashing secret: `npx wrangler secret put IP_HASH_SECRET`
   (paste any strong random value, e.g. the output of `openssl rand -hex 32`).
   This keys the HMAC used to hash visitor IPs for the debounce check — it
   must never be committed to git, which is why it's a secret rather than a
   `wrangler.toml` value.

## Deploy

```bash
npm run deploy
```

This prints the Worker's URL (e.g. `https://little-hello-counter.<you>.workers.dev`).
To turn the feature on for the deployed site, go to the main repo's GitHub
page → **Settings → Secrets and variables → Actions → Variables** → **New
repository variable**, name it `VITE_COUNTER_API_URL`, and set its value to
that Worker URL (no trailing slash). It must be added as a **Variable**, not
a Secret — `.github/workflows/deploy.yml` reads it via
`${{ vars.VITE_COUNTER_API_URL }}`. The next push to `main` (or a manual
re-run of the deploy workflow) will pick it up and the tagline will appear on
the live site.

## Local development

```bash
npm run dev
```

`wrangler dev` needs the `IP_HASH_SECRET` binding to be present locally too.
A `worker/.dev.vars` file (git-ignored, never commit it) already provides a
placeholder value for this — wrangler loads it automatically. If it's
missing, recreate it with:

```
IP_HASH_SECRET=local-dev-secret-change-me
```

To test a local React dev server (e.g. Vite's default
`http://localhost:5173`) against this local Worker, temporarily add that
origin to `ALLOWED_ORIGINS` in `src/index.ts` — later tasks in this plan
will need to do exactly that.

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
- Concurrent increments from different visitors can race (KV has no atomic
  increment) and may occasionally undercount by one — an accepted tradeoff
  for a feel-good approximate number, not a bug.
- The client optimistically bumps its locally-displayed count by 1 on every
  successful action (share, copy, download), but the server-side 60-second
  per-IP debounce may collapse several rapid same-visitor actions into a
  single real increment. That means the number shown in one session can
  briefly run ahead of the true server count — e.g. sharing and then
  downloading the same card within a minute shows +2 locally but only +1 on
  the server. It self-corrects the next time the page loads and re-fetches
  the real count; this is an accepted tradeoff, not a bug.
