# Little Hello

Little Hello is a lightweight, privacy-first greeting card maker. Choose a
design, write a short message, and share a card without an account or backend.
All card content is created and rendered locally in the browser.

## Architecture review

- **Static hosting:** React + TypeScript + Vite produces a deployable `dist/`
  directory for GitHub Pages or a custom domain. `VITE_BASE_PATH` controls the
  Vite base path; custom domains use `/`.
- **Card permanence:** released template IDs are immutable public identifiers.
  Card URLs will use a versioned compact payload in the URL hash
  (`#/card/<payload>`), so GitHub Pages does not need route rewrites. Treat the
  hash as untrusted input and validate every field.
- **Privacy:** no account, database, analytics, tracking, or card-content API is
  required. The MVP does not persist greeting text to local storage.
- **Sent counter (one narrow exception):** a single public tagline ("N
  Little Hellos sent so far") is powered by a small external Cloudflare
  Worker holding one anonymous integer. This is the one deliberate exception
  to "no backend" in this document — it never receives card content, names,
  identifiers, or cookies, only a bare "one more happened" signal. Full
  scope and privacy boundary: `docs/superpowers/specs/2026-09-13-sent-counter-design.md`.
  Leaving `VITE_COUNTER_API_URL` unset (the default for local dev and forks)
  fully disables the feature: no requests, no UI. Worker setup:
  `worker/README.md`.
- **Templates:** artwork stays in local application assets and is separate from
  card content. New artwork must receive a new permanent template ID.
- **Offline:** `vite-plugin-pwa` and Workbox precache the application shell and
  bundled template assets. Card URL decoding and native PNG export run locally
  in the browser, including after the first visit has been cached.

### Dependency evaluation

The runtime only needs React and React DOM. Native hash navigation, form
controls, CSS, the Web Share API, and the Clipboard API are preferred over
larger libraries. `vite-plugin-pwa` is the one additional build dependency
because it provides the required Workbox integration and installability.
SVG/canvas rendering and a small client-side image exporter can be evaluated in
Phase 2; no export dependency is needed for Phase 1.

### MCP and testing

Playwright MCP is a development-only tool and should be used to explore mobile
layouts, accessibility, shared-card URLs, downloads, and offline behavior. The
planned test stack is Vitest + React Testing Library for serialization and UI
units, and Playwright for browser journeys. MCP is never shipped in the app.

## Phase 1

Phase 1 includes the responsive shell, occasion selector, eight local
placeholder templates, constrained editor, and a live preview. Phase 2 adds
versioned hash serialization, validated shared-card links, a presentation-only
shared-card viewer, Clipboard/Web Share actions, and native PNG export.

The message typography system provides a small curated set of stable font IDs.
Each template recommends a default personality, while the editor lets users
choose a different font for the main message. To and From remain on the
supporting UI font. The selected font ID is included in new shared URLs;
older URLs without that field continue to use the template default. Font
families use local/system-safe stacks so cards remain usable offline and PNG
exports use the same stable mapping.

The visual collections use original artwork generated in-house with AI tools
(Google Gemini), reviewed, cropped, and optimized before being bundled as
static assets. No third-party or public-domain photography/illustration is
used.

## Local development

```bash
npm install
npm run dev
```

Available checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` runs checks, builds `dist/` with
`VITE_BASE_PATH=/<repository-name>/`, and deploys through the official Pages
actions. For a custom domain, build with `VITE_BASE_PATH=/`.

## Adding templates

Add the artwork asset and a new entry to `src/data/templates.ts`. Template IDs
are permanent public identifiers: never reuse an existing ID for a different
design, and keep retired templates readable whenever practical. Keep artwork
and card content separate so the renderer can evolve without changing the
template data contract.

## Support Little Hello

Little Hello is free, with no ads, paywalls, accounts, or payments required to
create, download, or share a card. If you'd like to help keep it going, you
can send a little love back via [Ko-fi](https://ko-fi.com/nourilee) — this is
entirely optional and Ko-fi handles all payment details; Little Hello never
sees or stores any card content, personal information, or payment data.

The in-app prompt is a beta feature controlled by a single flag in
`src/config/support.ts` and can be disabled by setting `enabled: false`.

## Credit

Created by [Nourilee Santos](https://www.linkedin.com/in/nourileesantos/).
