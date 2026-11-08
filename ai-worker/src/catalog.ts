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

export const styles = ['watercolor', 'minimalist', 'pastel', 'hand-drawn', 'floral', 'whimsical', 'elegant'] as const
export type Style = (typeof styles)[number]

export function templatesForOccasion(occasion: Occasion): CardTemplate[] {
  return cardTemplates.filter((template) => template.occasion === occasion)
}

export function isMessageFontId(value: unknown): value is MessageFontId {
  return typeof value === 'string' && messageFonts.some((font) => font.id === value)
}
