import {
  isMessageFontId,
  normalizeStyle,
  occasions,
  recipients,
  templatesForOccasion,
  tones,
  type MessageFontId,
  type Occasion,
  type Recipient,
  type Style,
  type Tone,
} from './catalog'

export const LIMITS = {
  /** Same limit as the app's message textarea and share-link codec. */
  personalMessage: 500,
  extraInstructions: 200,
  /** Cloudflare's documented maximum Turnstile token length. */
  turnstileToken: 2048,
  generatedMessageMin: 40,
  generatedMessageMax: 500,
} as const

export type MessageRequest = {
  turnstileToken: string
  occasion: Occasion
  recipient: Recipient
  tone: Tone
  style: Style
  personalMessage: string
  extraInstructions: string
}

export type Validation<T> = { ok: true; value: T } | { ok: false; reason: string }

// C0 control characters other than tab/newline/carriage return, plus DEL.
// Matching control characters is the point of this pattern.
// oxlint-disable-next-line no-control-regex
const DISALLOWED_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

function oneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function optionalText(value: unknown, max: number, field: string): Validation<string> {
  if (value === undefined || value === null) return { ok: true, value: '' }
  if (typeof value !== 'string') return { ok: false, reason: `${field} must be a string` }
  if (value.length > max) return { ok: false, reason: `${field} is too long` }
  if (DISALLOWED_CONTROL.test(value)) return { ok: false, reason: `${field} contains control characters` }
  return { ok: true, value: value.trim() }
}

/** Validates the body of POST /v1/generate/message. Unknown fields are ignored. */
export function validateMessageRequest(body: unknown): Validation<MessageRequest> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'body must be an object' }
  const input = body as Record<string, unknown>

  const token = input.turnstileToken
  if (typeof token !== 'string' || token.length === 0 || token.length > LIMITS.turnstileToken) {
    return { ok: false, reason: 'turnstileToken is missing or invalid' }
  }
  if (!oneOf(occasions, input.occasion)) return { ok: false, reason: 'unsupported occasion' }
  if (!oneOf(recipients, input.recipient)) return { ok: false, reason: 'unsupported recipient' }
  if (!oneOf(tones, input.tone)) return { ok: false, reason: 'unsupported tone' }
  const style = normalizeStyle(input.style)
  if (!style) return { ok: false, reason: 'unsupported style' }

  const personalMessage = optionalText(input.personalMessage, LIMITS.personalMessage, 'personalMessage')
  if (!personalMessage.ok) return personalMessage
  const extraInstructions = optionalText(input.extraInstructions, LIMITS.extraInstructions, 'extraInstructions')
  if (!extraInstructions.ok) return extraInstructions

  return {
    ok: true,
    value: {
      turnstileToken: token,
      occasion: input.occasion,
      recipient: input.recipient,
      tone: input.tone,
      style,
      personalMessage: personalMessage.value,
      extraInstructions: extraInstructions.value,
    },
  }
}

export type GeneratedCardText = {
  message: string
  /** Undefined when the model's suggestion wasn't one of the occasion's templates. */
  templateId?: string
  /** Undefined when the model's suggestion wasn't a known font. */
  messageFont?: MessageFontId
}

const HTML_TAG = /<\/?[a-z!][^>]*>|<[^>]*>/i
const URL_LIKE = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|co|ly|app|dev)\b/i
const MARKDOWN = /\*\*|__|`|^\s*#{1,6}\s|^\s*[-*]\s/m
const PLACEHOLDER = /\[[^\]]*\]|\{[^}]*\}/
const META_TALK = /^(sure|certainly|of course|here(?:'s| is| are))\b|\bas an ai\b|\blanguage model\b|\bi (?:cannot|can't|can not) (?:help|assist|provide|create|write)\b/i
const WRAPPING_QUOTES = /^["“”'‘’](.*)["“”'‘’]$/s

/**
 * Tidies AI output (never the user's own words): collapses whitespace as the
 * card renderer does, removes one pair of quotes wrapping the whole message,
 * and adds a full stop when the model left the last sentence unfinished.
 */
export function normalizeGeneratedMessage(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim()
  const unwrapped = collapsed.match(WRAPPING_QUOTES)
  const message = unwrapped ? unwrapped[1].trim() : collapsed
  return /[\p{L}\p{N}]$/u.test(message) ? `${message}.` : message
}

export function checkGeneratedMessage(value: unknown): Validation<string> {
  if (typeof value !== 'string') return { ok: false, reason: 'message is not a string' }
  if (DISALLOWED_CONTROL.test(value)) return { ok: false, reason: 'message contains control characters' }
  if (MARKDOWN.test(value)) return { ok: false, reason: 'message contains markdown' }
  const message = normalizeGeneratedMessage(value)
  if (message.length < LIMITS.generatedMessageMin) return { ok: false, reason: 'message is too short' }
  if (message.length > LIMITS.generatedMessageMax) return { ok: false, reason: 'message is too long' }
  if (HTML_TAG.test(message)) return { ok: false, reason: 'message contains markup' }
  if (URL_LIKE.test(message)) return { ok: false, reason: 'message contains a link' }
  if (PLACEHOLDER.test(message)) return { ok: false, reason: 'message contains a placeholder' }
  if (META_TALK.test(message)) return { ok: false, reason: 'message contains assistant meta-talk' }
  return { ok: true, value: message }
}

/** Accepts the model's JSON either as an object or as a string (optionally wrapped in a ```json fence). */
function toObject(raw: unknown): Record<string, unknown> | null {
  let value = raw
  if (typeof value === 'string') {
    const unfenced = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    try {
      value = JSON.parse(unfenced)
    } catch {
      return null
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/**
 * Validates the text model's output for the given occasion. An invalid message
 * fails validation, which leads to a retry. An invalid template or font is only
 * dropped, and the caller substitutes its deterministic choice.
 */
export function validateGeneratedCardText(raw: unknown, occasion: Occasion): Validation<GeneratedCardText> {
  const output = toObject(raw)
  if (!output) return { ok: false, reason: 'output is not a JSON object' }
  const message = checkGeneratedMessage(output.message)
  if (!message.ok) return message
  const templateId =
    typeof output.templateId === 'string' && templatesForOccasion(occasion).some(({ id }) => id === output.templateId)
      ? output.templateId
      : undefined
  const messageFont = isMessageFontId(output.messageFont) ? output.messageFont : undefined
  return { ok: true, value: { message: message.value, templateId, messageFont } }
}
