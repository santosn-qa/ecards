# Dependency Policy

Before adding a dependency, answer:

1. Does an existing dependency already solve the problem?
2. Can a native browser API or a small local helper solve it?
3. Is the project actively maintained?
4. Is its license compatible?
5. What is the bundle-size and startup impact?
6. Does it work offline?
7. Does it add external runtime requests?
8. Is it necessary for a concrete requirement?

Explain the decision in the change summary. Prefer native APIs and CSS. Runtime
dependencies must be especially well justified because the app is static,
privacy-first, and offline-capable. Development-only tools must not enter the
production bundle.
