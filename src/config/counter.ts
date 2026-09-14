// `import.meta.env.VITE_COUNTER_API_URL` only exists in a Vite-processed
// context (dev server or build). Optional-chaining on `.env` keeps this
// import safe when a test file imports this module directly through
// Playwright's plain Node/TypeScript runner, where `import.meta.env` is
// undefined.
export const COUNTER_CONFIG = {
  apiUrl: import.meta.env?.VITE_COUNTER_API_URL as string | undefined,
}
