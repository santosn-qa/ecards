# AI Project Status

## Current phase

Phase 1: responsive card creation shell.

## Current functionality

- React + TypeScript + Vite static app
- Responsive occasion selector and template gallery
- Eight local placeholder templates with immutable IDs
- Constrained editor and live preview
- Configurable GitHub Pages base path
- PWA/Workbox build configuration
- GitHub Pages deployment workflow
- Playwright smoke-test configuration

## Known issues and deferred work

- Card URL serialization and shared-card viewer are not implemented.
- PNG export and Web Share API integration are not implemented.
- Unit-test tooling is not configured; the current automated suite is browser
  smoke coverage.
- Placeholder artwork needs human visual approval before production use.

## Test status

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run test:e2e` before release. The Phase 1 implementation has previously
passed lint, typecheck, and build; this workflow change adds the Playwright
smoke suite for ongoing validation.
