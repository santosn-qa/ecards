// The optional "Create with AI" feature is on only when both values are set at
// build time (Cloudflare Workers Builds variables for production). Leaving
// either unset means no UI and no requests, the same as the sent counter.
// Optional chaining keeps this importable from Playwright's plain Node runner.
const apiUrl = import.meta.env?.VITE_AI_API_URL as string | undefined
const turnstileSiteKey = import.meta.env?.VITE_TURNSTILE_SITE_KEY as string | undefined

export const AI_CONFIG = {
  apiUrl,
  turnstileSiteKey,
  enabled: Boolean(apiUrl && turnstileSiteKey),
}
