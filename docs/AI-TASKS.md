# Reusable AI Task Templates

## New feature

> Investigate the existing architecture, dependencies, tests, and relevant UI
> before implementing. Explain a concise plan, affected files, risks, and
> validation. Make the smallest change, preserve privacy and offline behavior,
> then run the relevant checks and browser journey.

## Bug investigation

> Reproduce the failure and inspect browser state, console, network, timing,
> and environment evidence. Determine whether it is an application, test,
> data, environment, timing, or browser issue. Do not change the test until the
> root cause is understood.

## Refactoring

> Preserve behavior and tests. Inspect call sites first, make an incremental
> change, avoid public template-ID or URL-schema breakage, and compare before
> and after validation.

## Test creation

> Identify the user behavior and failure mode first. Write stable assertions
> using roles, labels, visible text, and meaningful outcomes rather than DOM
> structure or timing tricks.

## Exploratory testing

> Use Playwright MCP on the running app. Execute the critical journey, try
> invalid input, inspect accessibility, responsive layouts, console errors,
> failed requests, and offline behavior. Report defects separately from test
> harness failures.

## Accessibility review

> Inspect the running UI with keyboard and accessibility snapshots. Verify
> names, labels, focus, contrast, touch targets, readable text, and mobile
> usability. Fix application defects rather than weakening checks.

## Performance review

> Analyze the production bundle, assets, network requests, caching, and startup
> cost. Identify unnecessary dependencies or remote requests and quantify
> meaningful regressions before proposing changes.

## PWA/offline review

> Build and serve the production app, confirm service-worker registration and
> precache, disable network after the first load, and verify the implemented
> user journey remains functional.

## Release smoke test

> Verify home, template selection, recipient/message/sender entry, preview,
> URL generation and shared reconstruction when implemented, PNG download when
> implemented, service-worker caching, offline startup, and one mobile viewport.
