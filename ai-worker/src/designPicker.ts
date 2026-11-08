import { templatesForOccasion, type MessageFontId, type Occasion, type Style, type Tone } from './catalog'

// Rough mapping from the visual styles offered in the AI panel to the existing
// templates' `style` values, best match first. With 1–3 templates per occasion
// this is a preference, not a promise: richer matching needs more artwork.
const templateStylePreference: Record<Style, string[]> = {
  watercolor: ['botanical', 'romantic', 'sunny'],
  minimalist: ['editorial', 'sunny'],
  pastel: ['sunny', 'romantic', 'playful'],
  'hand-drawn': ['doodle', 'handmade', 'playful'],
  floral: ['botanical', 'playful', 'romantic'],
  whimsical: ['doodle', 'celebration', 'playful'],
  elegant: ['editorial', 'romantic', 'celebration'],
}

const fontForTone: Record<Tone, MessageFontId> = {
  sweet: 'quicksand',
  funny: 'caveat',
  heartfelt: 'cormorant',
  playful: 'caveat',
  encouraging: 'space-grotesk',
  romantic: 'dancing-script',
  formal: 'libre-baskerville',
}

/** Picks the occasion's template that best matches the style; always returns one of the occasion's templates. */
export function pickTemplateId(occasion: Occasion, style: Style): string {
  const candidates = templatesForOccasion(occasion)
  for (const preferred of templateStylePreference[style]) {
    const match = candidates.find((template) => template.style === preferred)
    if (match) return match.id
  }
  return candidates[0].id
}

export function pickMessageFont(tone: Tone): MessageFontId {
  return fontForTone[tone]
}
