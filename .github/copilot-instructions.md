# Little Hello Copilot Instructions

## Product and architecture

Little Hello is a privacy-first, static React + TypeScript + Vite application
hosted on GitHub Pages. It has no backend, accounts, analytics, tracking,
database, cloud storage, or card-content API. Card content is created and
rendered locally.

Keep the product intentionally simple: choose an occasion, choose a design,
write a message, preview it, and share it. Do not turn it into a general
purpose design editor.

Template IDs are permanent public identifiers. Never reuse an ID for a
different design or casually remove a released template. Keep artwork separate
from card content and bundle production assets locally.

Shared card state belongs in a versioned, compact URL hash. Hash data is
untrusted input: validate versions, fields, lengths, and template lookup
before rendering. Preserve compatibility with old schema versions.

The Vite `base` must remain configurable through `VITE_BASE_PATH`; routing must
work on GitHub Pages without server-side rewrites. PWA assets must remain local
and the application shell must continue to work offline after the first visit.

## Engineering rules

1. Inspect relevant source, configuration, dependencies, and tests before
   changing code.
2. For non-trivial work, state a concise plan, affected files, risks, and
   validation approach before implementation.
3. Make small, incremental, reversible changes. Preserve working behavior.
4. Prefer accessible user behavior in tests: roles, labels, visible text, and
   stable test IDs where necessary. Avoid brittle DOM or pixel assertions.
5. Use native browser APIs and existing dependencies before proposing a new
   dependency. Explain any new dependency's maintenance, license, bundle,
   offline, and network impact.
6. Do not hide failures by deleting tests, weakening assertions, adding
   arbitrary waits, suppressing errors, or silently catching exceptions.
7. When a test fails, first classify it as an application, automation, data,
   environment, timing, or browser problem and gather evidence before editing.
8. Never transmit or persist greeting content without an explicit product
   decision. Never add secrets, API keys, tracking, or third-party runtime
   scripts.
9. Check mobile touch targets, keyboard access, focus visibility, labels,
   contrast, responsive layout, and offline behavior for UI changes.
10. Run the smallest relevant checks, then report files changed, checks run,
    results, and remaining risks.

## Standard validation

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Use Playwright MCP or the Playwright test runner to verify UI changes in a
real browser. MCP is a development tool only and must never be bundled into
the production application.

Pause for human approval before changing URL schema, template IDs, privacy
behavior, architecture, major UX, or introducing a production dependency.
