import { normalizeStyle, occasions, type Occasion, type Style } from './catalog'
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
  const style = normalizeStyle(input.style)
  if (!style) return { ok: false, reason: 'unsupported style' }
  return { ok: true, value: { turnstileToken: token, occasion: input.occasion as Occasion, style } }
}

// Scenes and style follow docs/BIRTHDAY-GARDEN-ART-PROMPT.md, the brief behind
// Little Hello's own artwork, so AI pictures sit comfortably beside it.
const motifs: Record<Occasion, string> = {
  Birthday: 'a hand-painted layered birthday cake with imperfect icing and a few candles, surrounded by flowers and loose leaves, a satin ribbon and a few paper confetti shapes',
  'Thank you': 'a small wrapped gift tied with a satin ribbon beside an envelope and a sprig of flowers and leaves',
  Congratulations: 'two glasses raised in a toast beside a generous bouquet of flowers, with a loose satin ribbon and a few paper confetti shapes',
  Love: 'two ceramic mugs side by side beside a small vase of wildflowers, with a soft satin ribbon',
  'Just because': 'a gentle arrangement of gardenias and garden flowers with a flowing satin ribbon',
}

/** The three looks, matching the brief's three directions and the app's artwork collections. */
const looks: Record<Style, string> = {
  botanical: 'Botanical and elegant: loose botanical leaves and delicate gouache flowers lead the composition, light and airy.',
  celebration: 'Joyful and celebratory: a little more festive, with paper confetti and a ribbon adding movement, still soft and refined.',
  painterly: 'Painterly and editorial: richer, deeper colours and confident visible brushstrokes, like a small matte gouache painting, with no glossy highlights.',
}

const HOUSE_STYLE = [
  'Premium illustrated stationery, hand-painted in gouache and watercolor on warm cream textured paper.',
  'Palette: warm terracotta, apricot, butter yellow, muted sage, dusty rose and warm cream, with small accents of deep burgundy.',
  'Subtle paper grain, brush variation and imperfect painted edges. Calm, warm, grown-up and tasteful.',
  'The whole background is plain, warm cream paper, not white. Soft, even light with no photographic shading or reflections.',
  'Not a photograph, not 3D, not flat vector art, not a cartoon. Avoid neon and rainbow colours.',
].join(' ')

/**
 * The image prompt. Pictures are shown above the message, cropped to a wide
 * band across the middle, so the scene is asked to sit there. Text is never
 * requested: the card renders all words separately.
 */
export function buildIllustrationPrompt(request: Pick<IllustrationRequest, 'occasion' | 'style'>): string {
  return [
    `Greeting card artwork of ${motifs[request.occasion]}.`,
    looks[request.style],
    HOUSE_STYLE,
    'Composition: one compact, centred arrangement that fills only the middle half of the frame, with generous empty paper all around it and nothing near the edges.',
    'No text, no letters, no words, no numbers, no logos, no signature, no watermark, no border, no frame, no people.',
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
