export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 5000

export type TurnstileOutcome =
  | { ok: true }
  | { ok: false; reason: 'rejected' | 'hostname_mismatch' | 'unavailable'; errorCodes?: string[] }

type SiteverifyResponse = { success?: unknown; hostname?: unknown; 'error-codes'?: unknown }

/**
 * Verifies a single-use Turnstile token with Cloudflare's siteverify API.
 * Fails closed: a missing secret, network error, timeout or malformed reply
 * never counts as a pass.
 */
export async function verifyTurnstile(options: {
  token: string
  secret: string
  remoteIp?: string
  expectedHostnames: Set<string>
  fetchImpl?: typeof fetch
}): Promise<TurnstileOutcome> {
  if (!options.secret) return { ok: false, reason: 'unavailable' }
  const fetchImpl = options.fetchImpl ?? fetch
  const body = new URLSearchParams({ secret: options.secret, response: options.token })
  if (options.remoteIp) body.set('remoteip', options.remoteIp)

  let result: SiteverifyResponse
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
    if (!response.ok) return { ok: false, reason: 'unavailable' }
    result = (await response.json()) as SiteverifyResponse
  } catch {
    return { ok: false, reason: 'unavailable' }
  }

  if (result.success !== true) {
    const errorCodes = Array.isArray(result['error-codes'])
      ? result['error-codes'].filter((code): code is string => typeof code === 'string')
      : undefined
    return { ok: false, reason: 'rejected', errorCodes }
  }
  if (options.expectedHostnames.size > 0) {
    if (typeof result.hostname !== 'string' || !options.expectedHostnames.has(result.hostname)) {
      return { ok: false, reason: 'hostname_mismatch' }
    }
  }
  return { ok: true }
}
