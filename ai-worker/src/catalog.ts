// Allow-lists shared with the app. Templates, occasions and fonts are imported
// from the app's own data files so the Worker can never suggest a design the
// renderer doesn't have.
import { cardTemplates, occasions, type CardTemplate, type Occasion } from '../../src/data/templates'
import { messageFonts, type MessageFontId } from '../../src/data/typography'

export { cardTemplates, messageFonts, occasions }
export type { CardTemplate, MessageFontId, Occasion }

export const recipients = ['friend', 'family', 'partner', 'colleague', 'someone'] as const
export type Recipient = (typeof recipients)[number]

export const tones = ['sweet', 'funny', 'heartfelt', 'playful', 'encouraging', 'romantic', 'formal'] as const
export type Tone = (typeof tones)[number]

/** The three looks, matching Little Hello's own artwork collections. */
export const styles = ['botanical', 'celebration', 'painterly'] as const
export type Style = (typeof styles)[number]

// Looks offered by earlier versions of the app, which a browser may still have
// cached for a while. They map to the nearest current look instead of failing.
const legacyStyles: Record<string, Style> = {
  watercolor: 'botanical',
  floral: 'botanical',
  pastel: 'botanical',
  minimalist: 'botanical',
  whimsical: 'celebration',
  'hand-drawn': 'celebration',
  elegant: 'painterly',
}

export function normalizeStyle(value: unknown): Style | undefined {
  if (typeof value !== 'string') return undefined
  if ((styles as readonly string[]).includes(value)) return value as Style
  return legacyStyles[value]
}

export function templatesForOccasion(occasion: Occasion): CardTemplate[] {
  return cardTemplates.filter((template) => template.occasion === occasion)
}

export function isMessageFontId(value: unknown): value is MessageFontId {
  return typeof value === 'string' && messageFonts.some((font) => font.id === value)
}
