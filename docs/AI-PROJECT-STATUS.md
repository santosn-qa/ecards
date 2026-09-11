# AI Project Status

## Current phase

Phase 2: shareable cards and local export.

## Current functionality

- React + TypeScript + Vite static app
- Responsive occasion selector and template gallery
- Eight local placeholder templates with immutable IDs
- Constrained editor and live preview
- Configurable GitHub Pages base path
- PWA/Workbox build configuration
- GitHub Pages deployment workflow
- Playwright smoke-test configuration
- Versioned, validated card URLs in the hash
- Shared-card presentation view
- Clipboard/Web Share actions
- Native 1080px PNG export

## Known issues and deferred work

- Unit-test tooling is not configured; the current automated suite is browser
  smoke coverage.
- Placeholder artwork needs human visual approval before production use.

## Test status

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run test:e2e` before release. Phase 2 smoke coverage verifies editor preview updates, generated share URLs,
shared-card reconstruction, and malformed URL handling.
