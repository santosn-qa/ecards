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
