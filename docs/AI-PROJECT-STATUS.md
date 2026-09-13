# AI Project Status

## Current phase

Phase 2: shareable cards and local export.

## Current functionality

- React + TypeScript + Vite static app
- Responsive occasion selector and template gallery
- Eight local placeholder templates with immutable IDs
- Constrained editor and live preview
- Static per-occasion sample message chips in the editor
- Configurable GitHub Pages base path
- PWA/Workbox build configuration
- GitHub Pages deployment workflow
- Playwright smoke-test configuration
- Versioned, validated card URLs in the hash (compact v2 format with
  native deflate compression; legacy v1 links still decode)
- Shared-card presentation view
- Clipboard/Web Share actions
- Native 1080px PNG export
- Branded page title and Open Graph/Twitter share-preview metadata
- WCAG AA-compliant secondary text and primary-button contrast
- Empty-message confirmation guard on Copy Link/Share Card
- Typed-draft protection on sample message chips (free browsing when empty,
  confirm-to-replace once the user has typed their own text)
- Mobile live preview ordered after the message step, not before the design step
- Visible "Made privately" mobile trust label (no longer `font-size: 0`)
- Desktop chevron controls for the message-font carousel
- Character counters on the To/From fields

## Known issues and deferred work

- Unit-test tooling is not configured; the current automated suite is browser
  smoke coverage.
- Placeholder artwork needs human visual approval before production use.

## Test status

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run test:e2e` before release. Phase 2 smoke coverage verifies editor preview updates, generated share URLs,
shared-card reconstruction, and malformed URL handling.
