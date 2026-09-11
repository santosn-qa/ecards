# Development Tools

| Tool | Purpose | License / impact | Runtime? |
| --- | --- | --- | --- |
| Playwright | Browser automation and E2E testing | Apache-2.0; development-only browser binaries and test dependency | No |
| Playwright MCP | AI-driven browser exploration and verification | Open-source development integration; no production bundle impact | No |
| vite-plugin-pwa | Vite PWA generation and Workbox integration | MIT; build-time dependency that generates service-worker assets | Indirectly, generated assets |
| Workbox | Service-worker precaching and runtime caching | MIT; used through vite-plugin-pwa | Generated service worker |

VS Code development can launch Playwright MCP from
`.vscode/mcp.json`. It runs `npx @playwright/mcp@latest` on demand and is
development-only; it is not installed into or bundled by the application.

Evaluate other tools only when a concrete requirement exists. Check current
maintenance, license, bundle impact, browser support, offline behavior, and
network requirements before adoption. MCP tools are never production code.
