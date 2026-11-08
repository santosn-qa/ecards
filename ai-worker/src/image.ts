import { occasions, styles, type Occasion, type Style } from './catalog'
import { LIMITS, type Validation } from './validate'

export type IllustrationRequest = { turnstileToken: string; occasion: Occasion; style: Style }

/**
 * Validates POST /v1/generate/illustration. Deliberately takes no free text:
 * image prompts are built only from allow-listed choices, so a visitor can't
 * steer the model towards unsafe or off-brand pictures.
 */
export function validateIllustrationRequest(body: unknown): Validation<IllustrationRequest> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'body must be an object' }
  const input = body as Record<string, unknown>
  const token = input.turnstileToken
  if (typeof token !== 'string' || token.length === 0 || token.length > LIMITS.turnstileToken) {
    return { ok: false, reason: 'turnstileToken is missing or invalid' }
  }
  if (typeof input.occasion !== 'string' || !(occasions as readonly string[]).includes(input.occasion)) {
    return { ok: false, reason: 'unsupported occasion' }
  }
  if (typeof input.style !== 'string' || !(styles as readonly string[]).includes(input.style)) {
    return { ok: false, reason: 'unsupported style' }
  }
  return { ok: true, value: { turnstileToken: token, occasion: input.occasion as Occasion, style: input.style as Style } }
}

const motifs: Record<Occasion, string> = {
  Birthday: 'a celebration cake with candles, a few balloons and scattered confetti',
  'Thank you': 'a bouquet of fresh flowers tied with a ribbon beside a small wrapped gift',
  Congratulations: 'two raised glasses of sparkling drink with ribbons and gentle sparkles',
  Love: 'two coffee cups side by side with small hearts and soft blossoms',
  'Just because': 'a cheerful patch of wildflowers with a butterfly',
}

const styleDescriptions: Record<Style, string> = {
  watercolor: 'A soft watercolor painting with gentle washes and visible paper texture',
  floral: 'A lush botanical floral illustration',
  pastel: 'A soft pastel illustration with an airy, gentle palette',
  whimsical: 'A whimsical storybook illustration, playful and dreamy',
  'hand-drawn': 'A hand-drawn ink and colored pencil illustration',
  minimalist: 'A minimalist illustration with simple shapes and plenty of calm empty space',
  elegant: 'An elegant gouache illustration with refined, muted colors',
}

/**
 * The image prompt. The left side is kept light and quiet because the card's
 * existing full-bleed layout places the message there over a soft wash.
 * Text is never requested: the card renders all words separately.
 */
export function buildIllustrationPrompt(request: Pick<IllustrationRequest, 'occasion' | 'style'>): string {
  return [
    `${styleDescriptions[request.style]} of ${motifs[request.occasion]}, as greeting card artwork.`,
    'Composition: keep the subject fairly small and place it in the right third of the frame, towards the lower right.',
    'The left two thirds must be calm, plain, light background with nothing in it, because the card message is printed there.',
    'Warm, friendly and suitable for all ages. Illustration, not a photograph.',
    'No text, no letters, no words, no numbers, no signature, no watermark, no border, no frame, no people.',
  ].join(' ')
}

export const IMAGE_LIMITS = {
  /** Real outputs were 320–367 KB; anything far outside that range is suspect. */
  maxBytes: 2 * 1024 * 1024,
  /** A rough check for blank or failed outputs: a flat 1024x1024 JPEG is only a few KB. */
  minBytes: 15 * 1024,
  minSide: 512,
  maxSide: 2048,
  /** The card is 4:5 and crops to fit; very wide or tall images would lose the subject. */
  minAspect: 0.5,
  maxAspect: 2,
} as const

export type ValidatedImage = { base64: string; width: number; height: number; bytes: number }

function base64ToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

/** Reads width and height from a JPEG's start-of-frame segment. Returns null if the file isn't a well-formed JPEG. */
export function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    // Standalone markers have no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null // Reached image data or the end before a frame header.
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (length < 2) return null
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isStartOfFrame) {
      if (offset + 9 > bytes.length) return null
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6]
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8]
      return width > 0 && height > 0 ? { width, height } : null
    }
    offset += 2 + length
  }
  return null
}

/** Checks the model's output is a complete JPEG of a usable size and shape. Never trusts anything else. */
export function validateIllustrationOutput(raw: unknown): Validation<ValidatedImage> {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'output is not an object' }
  const base64 = (raw as Record<string, unknown>).image
  if (typeof base64 !== 'string' || base64.length === 0) return { ok: false, reason: 'no image in output' }
  if (base64.length > Math.ceil((IMAGE_LIMITS.maxBytes * 4) / 3) + 4) return { ok: false, reason: 'image is too large' }
  const bytes = base64ToBytes(base64)
  if (!bytes) return { ok: false, reason: 'image is not valid base64' }
  if (bytes.length < IMAGE_LIMITS.minBytes) return { ok: false, reason: 'image is too small to be a real illustration' }
  if (bytes.length > IMAGE_LIMITS.maxBytes) return { ok: false, reason: 'image is too large' }
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return { ok: false, reason: 'image is truncated' }
  const size = jpegDimensions(bytes)
  if (!size) return { ok: false, reason: 'image is not a valid JPEG' }
  if (Math.min(size.width, size.height) < IMAGE_LIMITS.minSide || Math.max(size.width, size.height) > IMAGE_LIMITS.maxSide) {
    return { ok: false, reason: 'image dimensions are out of range' }
  }
  const aspect = size.width / size.height
  if (aspect < IMAGE_LIMITS.minAspect || aspect > IMAGE_LIMITS.maxAspect) return { ok: false, reason: 'unsupported aspect ratio' }
  return { ok: true, value: { base64, width: size.width, height: size.height, bytes: bytes.length } }
}
