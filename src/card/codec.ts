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

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
}

export function encodeCard(card: CardDraft, templateId: string) {
  const payload: EncodedCard = {
    v: CARD_SCHEMA_VERSION,
    template: templateId,
    to: card.to.trim(),
    message: card.message.trim(),
    from: card.from.trim(),
    ...(card.messageFont ? { messageFont: card.messageFont } : {}),
  }
  return toBase64Url(JSON.stringify(payload))
}

export function createCardUrl(card: CardDraft, templateId: string) {
  return `${window.location.origin}${window.location.pathname}#/card/${encodeCard(card, templateId)}`
}

export function decodeCardPayload(payload: string): DecodeResult {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(payload))
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

export function decodeCardHash(hash: string): DecodeResult | null {
  const match = hash.match(/^#\/card\/([^/?#]+)$/)
  return match ? decodeCardPayload(match[1]) : null
}
