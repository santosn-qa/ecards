import { cardTemplates, type Occasion } from '../data/templates'
import { messageFonts, type MessageFontId } from '../data/typography'

export const aiRecipients = [
  { id: 'friend', label: 'A friend' },
  { id: 'family', label: 'Family' },
  { id: 'partner', label: 'My partner' },
  { id: 'colleague', label: 'A colleague' },
] as const

/** The three looks, matching Little Hello's own artwork collections. `example` is a bundled artwork shown on the choice. */
export const aiLooks = [
  { id: 'botanical', label: 'Botanical', example: 'botanical-pressed-bouquet.jpg' },
  { id: 'celebration', label: 'Celebration', example: 'celebration-cake-ribbon.jpg' },
  { id: 'painterly', label: 'Painterly', example: 'artistic-midnight-bouquet.jpg' },
] as const

export type AiRecipient = (typeof aiRecipients)[number]['id']
export type AiLook = (typeof aiLooks)[number]['id']
export type AiTone = 'sweet' | 'funny' | 'heartfelt' | 'playful' | 'encouraging' | 'romantic' | 'formal'

/** The tone is chosen for the person, so nobody has to think about it. */
export function toneForRecipient(recipient: AiRecipient, occasion: Occasion): AiTone {
  if (recipient === 'partner') return 'romantic'
  if (recipient === 'colleague') return 'formal'
  if (occasion === 'Congratulations') return 'encouraging'
  return recipient === 'family' ? 'sweet' : 'heartfelt'
}

export type AiMessageRequest = {
  turnstileToken: string
  occasion: Occasion
  recipient: AiRecipient
  tone: AiTone
  style: AiLook
  personalMessage: string
  extraInstructions: string
}

export type AiCardSuggestion = {
  message: string
  templateId: string
  messageFont: MessageFontId
  source: 'ai' | 'user'
}

export type AiStatus = { enabled: boolean; signatureRemaining: number; creativeRemaining: number }

export type AiErrorCode =
  | 'invalid_request'
  | 'forbidden_origin'
  | 'verification_failed'
  | 'verification_unavailable'
  | 'rate_limited'
  | 'daily_limit_reached'
  | 'budget_exhausted'
  | 'ai_disabled'
  | 'generation_failed'
  | 'network'
  | 'aborted'
  | 'unexpected_response'

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiErrorCode; retryAfterSeconds?: number }

const knownErrors = new Set<string>([
  'invalid_request', 'forbidden_origin', 'verification_failed', 'verification_unavailable', 'rate_limited',
  'daily_limit_reached', 'budget_exhausted', 'ai_disabled', 'generation_failed',
])

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * Re-checks the Worker's answer against the app's own data before it reaches
 * the editor. The Worker validates too; this guards against a misconfigured
 * or replaced endpoint. React renders the message as text, never as HTML.
 */
export function parseSuggestion(value: unknown, occasion: Occasion): AiCardSuggestion | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const { message, templateId, messageFont, source } = candidate
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 500) return null
  const template = cardTemplates.find(({ id }) => id === templateId)
  if (!template || template.occasion !== occasion) return null
  if (!messageFonts.some(({ id }) => id === messageFont)) return null
  if (source !== 'ai' && source !== 'user') return null
  return { message, templateId: template.id, messageFont: messageFont as MessageFontId, source }
}

async function readError(response: Response): Promise<AiResult<never>> {
  try {
    const body = (await response.json()) as { error?: unknown; retryAfterSeconds?: unknown }
    if (typeof body.error === 'string' && knownErrors.has(body.error)) {
      return {
        ok: false,
        error: body.error as AiErrorCode,
        ...(typeof body.retryAfterSeconds === 'number' ? { retryAfterSeconds: body.retryAfterSeconds } : {}),
      }
    }
  } catch {
    // Fall through to a generic error below.
  }
  return { ok: false, error: 'unexpected_response' }
}

export async function fetchAiStatus(apiUrl: string, signal?: AbortSignal): Promise<AiResult<AiStatus>> {
  try {
    const response = await fetch(`${apiUrl}/v1/status`, { signal })
    if (!response.ok) return readError(response)
    const body = (await response.json()) as { enabled?: unknown; signatureRemaining?: unknown; creativeRemaining?: unknown }
    if (typeof body.enabled !== 'boolean' || typeof body.signatureRemaining !== 'number') {
      return { ok: false, error: 'unexpected_response' }
    }
    const creativeRemaining = typeof body.creativeRemaining === 'number' ? body.creativeRemaining : 0
    return { ok: true, value: { enabled: body.enabled, signatureRemaining: body.signatureRemaining, creativeRemaining } }
  } catch (error) {
    return { ok: false, error: isAbort(error) ? 'aborted' : 'network' }
  }
}

/** One request, never retried here: the Worker already makes at most one controlled retry. */
export async function generateAiMessage(apiUrl: string, request: AiMessageRequest, signal?: AbortSignal): Promise<AiResult<AiCardSuggestion>> {
  try {
    const response = await fetch(`${apiUrl}/v1/generate/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
    if (!response.ok) return readError(response)
    const suggestion = parseSuggestion(await response.json(), request.occasion)
    return suggestion ? { ok: true, value: suggestion } : { ok: false, error: 'unexpected_response' }
  } catch (error) {
    return { ok: false, error: isAbort(error) ? 'aborted' : 'network' }
  }
}

export type AiIllustrationRequest = { turnstileToken: string; occasion: Occasion; style: AiLook }
export type AiIllustration = { blob: Blob; width: number; height: number }

const ILLUSTRATION_MAX_BYTES = 2 * 1024 * 1024

/**
 * Checks a returned illustration is a complete JPEG before it can reach the
 * card: JPEG start and end markers, a size limit, and base64 only. The image
 * is then shown from a local blob: URL, never from a remote address.
 */
export function illustrationBytes(value: unknown): Uint8Array<ArrayBuffer> | null {
  if (!value || typeof value !== 'object') return null
  const { image, mimeType } = value as Record<string, unknown>
  if (mimeType !== 'image/jpeg' || typeof image !== 'string' || image.length === 0) return null
  if (image.length > Math.ceil((ILLUSTRATION_MAX_BYTES * 4) / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return null
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = Uint8Array.from(atob(image), (character) => character.charCodeAt(0))
  } catch {
    return null
  }
  const n = bytes.length
  if (n < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null
  if (bytes[n - 2] !== 0xff || bytes[n - 1] !== 0xd9) return null
  return bytes
}

/** One request, never retried here. The image must also decode in this browser at a usable size. */
export async function generateAiIllustration(apiUrl: string, request: AiIllustrationRequest, signal?: AbortSignal): Promise<AiResult<AiIllustration>> {
  try {
    const response = await fetch(`${apiUrl}/v1/generate/illustration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
    if (!response.ok) return readError(response)
    const bytes = illustrationBytes(await response.json())
    if (!bytes) return { ok: false, error: 'unexpected_response' }
    const blob = new Blob([bytes], { type: 'image/jpeg' })
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(blob)
    } catch {
      return { ok: false, error: 'unexpected_response' }
    }
    const { width, height } = bitmap
    bitmap.close()
    if (Math.min(width, height) < 512 || width / height < 0.5 || width / height > 2) return { ok: false, error: 'unexpected_response' }
    return { ok: true, value: { blob, width, height } }
  } catch (error) {
    return { ok: false, error: isAbort(error) ? 'aborted' : 'network' }
  }
}

/** Friendly copy for each failure. Every case leaves the normal editor fully usable. */
export function describeAiError(error: AiErrorCode, retryAfterSeconds?: number): string {
  switch (error) {
    case 'rate_limited':
      return `Just a moment. You can try again in ${retryAfterSeconds ?? 20} seconds.`
    case 'daily_limit_reached':
      return 'You’ve used today’s AI cards. Come back tomorrow, or write your own message below.'
    case 'budget_exhausted':
      return 'Little Hello’s AI helper is resting for today. It’s free to use and has a daily limit. Please try again tomorrow, or write your own message below.'
    case 'ai_disabled':
      return 'The AI helper is switched off right now. You can still make a card the usual way.'
    case 'verification_failed':
    case 'verification_unavailable':
      return 'We couldn’t confirm you’re human. Please try again.'
    case 'aborted':
      return 'Cancelled. Nothing was changed.'
    case 'network':
      return 'We couldn’t reach the AI helper. Check your connection and try again.'
    default:
      return 'The AI helper couldn’t write a card this time. Please try again, or pick a sample message below.'
  }
}
