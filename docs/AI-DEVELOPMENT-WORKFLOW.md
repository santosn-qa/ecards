# AI Development Workflow

## 1. Understand

Read the request, relevant source files, existing tests, package scripts,
configuration, and recent behavior. Search for existing helpers before adding
new ones. Identify privacy, GitHub Pages, PWA, template-ID, and URL-schema
constraints.

## 2. Plan

For non-trivial work, state what changes, why, affected files, risks, and how
the behavior will be tested. Surface ambiguity when it could change product
behavior or architecture.

## 3. Implement

Make the smallest coherent change. Preserve existing behavior and public
template IDs. Keep card rendering local and avoid backend or tracking
features.

## 4. Static validation

Run `npm run lint` and `npm run typecheck`. Fix errors rather than suppressing
them.

## 5. Tests and build

Run `npm test`, `npm run build`, and `npm run test:e2e` when configured. Test
user behavior, not implementation details.

## 6. Browser verification

For UI changes, start the app, use Playwright to exercise the affected
journey, inspect the accessibility tree, check the console, and check failed
network requests. Use mobile viewports where relevant.

## 7. Review

Review functionality, accessibility, mobile UX, performance, privacy, offline
behavior, URL safety, test quality, and maintainability. Use the checklists in
[AI-QA-WORKFLOW.md](./AI-QA-WORKFLOW.md) and
[AI-CODE-REVIEW.md](./AI-CODE-REVIEW.md).

## 8. Report

Report files changed, behavior added or changed, commands and browser checks
executed, results, known issues, and remaining risks. Do not claim checks that
were not run.
