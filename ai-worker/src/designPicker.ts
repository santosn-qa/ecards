import { templatesForOccasion, type MessageFontId, type Occasion, type Style, type Tone } from './catalog'

// Each look matches one of the existing artwork collections, best match first.
// With 1–3 templates per occasion this is a preference, not a promise.
const collectionPreference: Record<Style, string[]> = {
  botanical: ['botanical', 'artistic', 'celebration'],
  celebration: ['celebration', 'botanical', 'artistic'],
  painterly: ['artistic', 'botanical', 'celebration'],
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
  for (const preferred of collectionPreference[style]) {
    const match = candidates.find((template) => template.collection === preferred)
    if (match) return match.id
  }
  return candidates[0].id
}

export function pickMessageFont(tone: Tone): MessageFontId {
  return fontForTone[tone]
}
