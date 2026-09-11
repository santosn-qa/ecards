# AI Code Review

Review every change against these questions:

- **Correctness:** Does it solve the requested user behavior, including edge
  cases?
- **Architecture:** Does it preserve a static, serverless GitHub Pages app?
- **Security:** Are hashes, decoded card data, user text, and generated content
  validated and safely rendered?
- **Privacy:** Does it transmit or persist card content, add analytics, or add
  third-party runtime requests?
- **Performance:** Did it add unnecessary JavaScript, assets, network requests,
  or dependencies?
- **Accessibility:** Are semantic controls, labels, keyboard behavior, focus,
  contrast, and touch targets preserved?
- **Mobile UX:** Does the flow work at narrow widths without hover-only
  behavior or horizontal overflow?
- **Offline:** Are critical assets local and included in the PWA cache?
- **Test quality:** Do tests verify user outcomes and fail on real regressions?
- **Maintainability:** Is the code clear, typed, reusable, and consistent with
  existing patterns?

Flag public URL-schema changes, template-ID changes, privacy changes,
architecture changes, major UX changes, real application defects, and
significant bundle increases for human approval.
