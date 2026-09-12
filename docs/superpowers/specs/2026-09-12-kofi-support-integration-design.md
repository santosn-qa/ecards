# Ko-fi Support Integration — Design

## Goal

Add a lightweight, entirely optional way for users to voluntarily support Little
Hello's development via Ko-fi, without compromising any existing product
principle: free, no paywall, no ads, no account, no backend, no payment data
ever touched by Little Hello, no card-content tracking.

Little Hello only ever opens `https://ko-fi.com/nourilee` in a new tab. All
payment handling happens entirely on Ko-fi. No Ko-fi API, SDK, or script is
integrated.

## Privacy Disclaimer (must be visible in the UI copy, not just this doc)

Little Hello does not see, store, transmit, or associate any of the
following with a support click:

- card message, recipient, sender, or any card content
- names, emails, or other personal information
- payment or transaction details

The only thing persisted anywhere is a single timestamp
(`littleHelloSupportDismissedAt`) in the browser's `localStorage`, used purely
to avoid re-showing the support panel too often. If `localStorage` is
unavailable, the app continues to work normally and simply shows the panel
each time (fails open, never breaks the app).

The support panel copy must include an explicit line making this clear to
the user, e.g.:

> "We never see your card, your message, or any personal details — this just
> opens Ko-fi in a new tab."

## Scope decisions

- Post-action support panel appears **only in the creator's editor flow**,
  after a successful download or share. It does **not** appear on the
  recipient's shared-card view — recipients only see the footer link.
- Copy uses the user-provided wording verbatim (see below).
- CTA label: "Support Little Hello" (not the "buy a coffee" alternative).
- No new visual assets: reuse existing color tokens, button classes, and the
  app's existing convention of unicode/emoji glyphs (✦ ✧ ⌁) instead of custom
  icons — the 💌 emoji is the icon.
- No new dependencies (no analytics, no Ko-fi SDK, no new test framework).

## Files

- `src/config/support.ts` — single source of truth:
  ```ts
  export const SUPPORT_CONFIG = {
    enabled: true,
    provider: 'kofi',
    url: 'https://ko-fi.com/nourilee',
  }
  ```
  Setting `enabled: false` removes the footer link and the post-action panel
  everywhere; the rest of the app behaves identically.

- `src/support/supportPrompt.ts` — pure logic, no DOM access at import time:
  - `DISMISS_STORAGE_KEY = 'littleHelloSupportDismissedAt'`
  - `SUPPRESSION_WINDOW_MS` = 7 days
  - `shouldShowSupportPrompt(now: number, dismissedAt: number | null): boolean`
  - `readDismissedAt(): number | null` — wraps `localStorage.getItem` in
    try/catch, returns `null` on any failure (private mode, quota, disabled
    storage, etc.)
  - `recordDismissal(now: number): void` — wraps `localStorage.setItem` in
    try/catch, no-op on failure

- `src/components/SupportPanel.tsx` — the dismissible post-action panel.
  Props: `onDismiss: () => void`. Reads `SUPPORT_CONFIG` directly.

- `src/components/SupportFooterLink.tsx` — the small permanent footer link.
  Renders nothing when `SUPPORT_CONFIG.enabled` is `false`.

## Behavior in `App.tsx`

- New state: `showSupportPanel: boolean`, plus an in-memory
  `hasShownSupportPanelThisSession` flag (not persisted) so that downloading
  or sharing repeatedly in one sitting (e.g. testing fonts) doesn't re-trigger
  the panel every time.
- After `exportCard()` resolves successfully, and after `shareCard()`
  completes successfully (share sheet completed or link copied — not on
  cancel/failure), check:
  1. `SUPPORT_CONFIG.enabled`
  2. `!hasShownSupportPanelThisSession`
  3. `shouldShowSupportPrompt(Date.now(), readDismissedAt())`
  If all true, show the panel and set the session flag.
- Panel renders inline inside `.editor-panel`, directly below the existing
  `.action-status` line. It is not a modal: it doesn't block navigation, and
  the existing download/share buttons remain fully usable.
- Dismissing via "No thanks" **or** clicking "Support Little Hello" both call
  `recordDismissal(Date.now())` and hide the panel — clicking through
  shouldn't earn a re-prompt any sooner than declining does.
- The recipient (shared-card) view and the error view are unaffected except
  for the new footer link.

## Copy

Panel:

```
💌 Send a little love back

Little Hello is free, with no ads or paywalls. If this helped you make
someone's day a little brighter, you can help keep Little Hello going.

We never see your card, your message, or any personal details — this just
opens Ko-fi in a new tab.

[ Support Little Hello ]   No thanks
```

Footer (all three footer renders — editor, shared-success, shared-error):

```
Made for meaningful moments. [existing text unchanged]
Created by Nourilee Santos            Support Little Hello
```

The footer link is visually secondary — same muted, smaller styling as the
existing "Created by…" line, not competing with Create/Download/Share.

## Visual design

- Reuses existing color tokens (`#d26f4f` terracotta accent, `#fbfaf8` cream
  background, existing muted grays) and the existing `.primary-action` /
  `.secondary-action` pill-button classes for the CTA and dismiss control.
- No new CSS variables, no new icon/image assets.
- Responsive 320–430px: stacked layout, no horizontal overflow, CTA button
  keeps the existing ≥46px touch height.

## Accessibility

- CTA is a real `<a>` with descriptive accessible text (not just "Support"),
  `target="_blank" rel="noopener noreferrer"`, and visible focus state
  (reuses existing focus styles).
- "No thanks" is a real `<button>` with an accessible label indicating it
  dismisses the support panel (e.g. `aria-label="Dismiss support message"`).
- Panel is a non-modal region; screen reader users are never trapped in it.
- Sufficient contrast, matching existing text/background pairs already in
  use elsewhere in the app.

## Testing

This repo has no unit-test framework (Vitest/Jest) — only Playwright
(`tests/e2e/smoke.spec.ts`). Rather than add a new dependency, tests are
Playwright-only, in a new `tests/e2e/support.spec.ts`:

- **Pure logic** (`supportPrompt.ts`), run Node-side without a page:
  - `shouldShowSupportPrompt` returns `true` when never dismissed.
  - Returns `false` immediately after a dismissal.
  - Returns `true` again once 7 days have elapsed.
  - `readDismissedAt`/`recordDismissal` don't throw when `localStorage`
    throws (simulated).

- **Browser-driven**:
  - Panel appears after a successful download in the editor flow.
  - Panel appears after a successful share.
  - Panel does not appear when `SUPPORT_CONFIG.enabled` is `false` (test
    build flag or module mock).
  - CTA link has the exact configured Ko-fi URL, `target="_blank"`, and
    `rel="noopener noreferrer"`.
  - Dismissing hides the panel and persists `littleHelloSupportDismissedAt`;
    reloading and repeating the download/share flow does not show it again.
  - Footer link is present on the editor, shared-success, and shared-error
    views, and absent when the feature flag is disabled.
  - Mobile viewport (360px, matching the existing overflow test) — panel
    causes no horizontal overflow and CTA/dismiss remain reachable and
    correctly sized.

- **Regression**: re-run the full existing suite to confirm card creation,
  customization, preview, download, share, shared URLs, font selection, and
  offline/PWA behavior are unaffected.

## Rollout / kill switch

Setting `SUPPORT_CONFIG.enabled = false` in `src/config/support.ts` fully
disables the feature (no panel, no footer link) with no other code changes,
satisfying the beta feature-flag requirement.

## Out of scope (for this iteration)

- Support panel on the recipient's shared-card view (footer link only).
- Any Ko-fi API/webhook integration, donation amounts, or supporter data.
- Any analytics/conversion tracking for this feature.
