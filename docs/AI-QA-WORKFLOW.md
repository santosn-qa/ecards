# AI QA Workflow

## Smoke testing

1. Start the app with `npm run dev -- --host 127.0.0.1`.
2. Open it in Playwright and verify the home page has no console errors.
3. Select an occasion and design.
4. Fill recipient, message, and sender.
5. Verify the live preview shows the exact entered values.
6. Check keyboard navigation, accessible names, visible focus, and a 320–390px
   viewport.

## Exploratory testing

Use Playwright MCP for the running app. Execute the primary journey, then try
empty fields, maximum-length values, unusual punctuation, rapid selection
changes, reloads, malformed hashes, and missing templates. Record application
defects separately from automation or environment failures.

Prioritize crashes, inability to create a card, mismatched preview/export,
broken shared URLs, offline failures, corrupted URL crashes, broken controls,
incorrect data, mobile usability, and serious accessibility defects.

## Regression testing

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run test:e2e`. Compare the affected user journey with the baseline. Do not
change an assertion merely to make a failure pass.

## Accessibility and responsive checks

Inspect the accessibility snapshot and keyboard path. Verify labels, button
names, focus states, contrast, 44px touch targets, readable text, and no
horizontal overflow at 320, 375, 390, 414, 768, and desktop widths.

## Offline checks

Build and serve the production output, load once, confirm the service worker,
then disable network in the browser and reload. Verify the shell, bundled
templates, editor, preview, and any implemented export/share flow still work.
