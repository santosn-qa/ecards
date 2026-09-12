import { cardTemplates, type CardDraft } from '../data/templates'
import { messageFonts, type MessageFontId } from '../data/typography'

export const CARD_SCHEMA_VERSION = 1

export type EncodedCard = CardDraft & {
  v: typeof CARD_SCHEMA_VERSION
  template: string
  messageFont?: MessageFontId
}

export type DecodeResult =
  | { ok: true; card: EncodedCard }
  | { ok: false; reason: 'invalid' | 'unsupported' | 'missing-template' }

// Immutable, append-only — exactly like template IDs themselves (see
// README): a code's meaning can never change once a link using it has been
// shared. New templates/fonts are appended at the end, never inserted,
// reordered, or reused.
const TEMPLATE_CODES = [
  'birthday-confetti-01',
  'birthday-sunshine-01',
  'birthday-party-01',
  'thank-you-bloom-01',
  'thank-you-sincere-01',
  'congratulations-bright-01',
  'love-together-01',
  'love-letter-01',
  'just-because-doodle-01',
]

const FONT_CODES: MessageFontId[] = [
  'caveat',
  'dancing-script',
  'cormorant',
  'dm-serif',
  'libre-baskerville',
  'quicksand',
  'satisfy',
  'space-grotesk',
]

type CompactPayload = {
  t: number
  n: string
  m: string
  f: string
  mf?: number
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeCard(card: CardDraft, templateId: string): Promise<string> {
  const payload: CompactPayload = {
    t: TEMPLATE_CODES.indexOf(templateId),
    n: card.to.trim(),
    m: card.message.trim(),
    f: card.from.trim(),
    ...(card.messageFont ? { mf: FONT_CODES.indexOf(card.messageFont) } : {}),
  }
  const json = new TextEncoder().encode(JSON.stringify(payload))
  const compressed = await deflate(json)
  return bytesToBase64Url(compressed)
}

export async function createCardUrl(card: CardDraft, templateId: string): Promise<string> {
  const payload = await encodeCard(card, templateId)
  return `${window.location.origin}${window.location.pathname}#/card/v2/${payload}`
}

function decodeLegacyPayload(payload: string): DecodeResult {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payload))
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'invalid' }
    const candidate = parsed as Record<string, unknown>
    if (candidate.v !== CARD_SCHEMA_VERSION) return { ok: false, reason: 'unsupported' }
    if (typeof candidate.template !== 'string' || !cardTemplates.some(({ id }) => id === candidate.template)) {
      return { ok: false, reason: 'missing-template' }
    }
    if (typeof candidate.to !== 'string' || candidate.to.length > 60) return { ok: false, reason: 'invalid' }
    if (typeof candidate.message !== 'string' || candidate.message.length > 500) return { ok: false, reason: 'invalid' }
    if (typeof candidate.from !== 'string' || candidate.from.length > 60) return { ok: false, reason: 'invalid' }
    const template = cardTemplates.find(({ id }) => id === candidate.template)!
    const requestedFont = typeof candidate.messageFont === 'string' ? candidate.messageFont : undefined
    const messageFont = messageFonts.find(({ id }) => id === requestedFont)?.id
    return {
      ok: true,
      card: {
        v: CARD_SCHEMA_VERSION,
        template: candidate.template,
        to: candidate.to,
        message: candidate.message,
        from: candidate.from,
        messageFont: messageFont || template.typography.defaultMessageFont,
      },
    }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

async function decodeCompactPayload(payload: string): Promise<DecodeResult> {
  try {
    const compressed = base64UrlToBytes(payload)
    const json = new TextDecoder().decode(await inflate(compressed))
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'invalid' }
    const candidate = parsed as Record<string, unknown>
    const templateId = typeof candidate.t === 'number' ? TEMPLATE_CODES[candidate.t] : undefined
    const template = templateId ? cardTemplates.find(({ id }) => id === templateId) : undefined
    if (!templateId || !template) return { ok: false, reason: 'missing-template' }
    if (typeof candidate.n !== 'string' || candidate.n.length > 60) return { ok: false, reason: 'invalid' }
    if (typeof candidate.m !== 'string' || candidate.m.length > 500) return { ok: false, reason: 'invalid' }
    if (typeof candidate.f !== 'string' || candidate.f.length > 60) return { ok: false, reason: 'invalid' }
    const requestedFont = typeof candidate.mf === 'number' ? FONT_CODES[candidate.mf] : undefined
    const messageFont = messageFonts.find(({ id }) => id === requestedFont)?.id
    return {
      ok: true,
      card: {
        v: CARD_SCHEMA_VERSION,
        template: templateId,
        to: candidate.n,
        message: candidate.m,
        from: candidate.f,
        messageFont: messageFont || template.typography.defaultMessageFont,
      },
    }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export type HashRoute =
  | { kind: 'none' }
  | { kind: 'legacy'; result: DecodeResult }
  | { kind: 'compact'; payload: string }

export function routeCardHash(hash: string): HashRoute {
  const legacyMatch = hash.match(/^#\/card\/([^/?#]+)$/)
  if (legacyMatch) return { kind: 'legacy', result: decodeLegacyPayload(legacyMatch[1]) }
  const compactMatch = hash.match(/^#\/card\/v2\/([^/?#]+)$/)
  if (compactMatch) return { kind: 'compact', payload: compactMatch[1] }
  return { kind: 'none' }
}

export async function decodeCardHash(hash: string): Promise<DecodeResult | null> {
  const route = routeCardHash(hash)
  if (route.kind === 'none') return null
  if (route.kind === 'legacy') return route.result
  return decodeCompactPayload(route.payload)
}
