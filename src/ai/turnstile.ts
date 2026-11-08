// Minimal loader for Cloudflare Turnstile with explicit rendering. The script
// is requested only when the AI panel opens, never on page load. Cloudflare
// requires it to come from this exact URL, so it can't be bundled or precached.
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileRenderOptions = {
  sitekey: string
  callback: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  appearance?: 'always' | 'execute' | 'interaction-only'
  size?: 'normal' | 'flexible' | 'compact'
  theme?: 'auto' | 'light' | 'dark'
}

export type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')))
    script.onerror = () => reject(new Error('Turnstile failed to load'))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loading = null // Allow a later attempt, e.g. after the connection comes back.
    throw error
  })
  return loading
}
