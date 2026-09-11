export type Occasion =
  | 'Birthday'
  | 'Thank you'
  | 'Congratulations'
  | 'Love'
  | 'Just because'

export type CardDraft = {
  to: string
  message: string
  from: string
}

export type CardTemplate = {
  id: string
  name: string
  occasion: Occasion
  artClass: string
  previewClass: string
}

export const occasions: Occasion[] = [
  'Birthday',
  'Thank you',
  'Congratulations',
  'Love',
  'Just because',
]

// IDs are permanent public identifiers. Never reuse an ID for a different design.
export const cardTemplates: CardTemplate[] = [
  { id: 'birthday-confetti-01', name: 'Confetti', occasion: 'Birthday', artClass: 'art-confetti', previewClass: 'preview-confetti-card' },
  { id: 'birthday-sunshine-01', name: 'Sunshine', occasion: 'Birthday', artClass: 'art-sunshine', previewClass: 'preview-sunshine-card' },
  { id: 'birthday-party-01', name: 'Party time', occasion: 'Birthday', artClass: 'art-party', previewClass: 'preview-party-card' },
  { id: 'thank-you-bloom-01', name: 'Bloom', occasion: 'Thank you', artClass: 'art-bloom', previewClass: 'preview-bloom-card' },
  { id: 'thank-you-sincere-01', name: 'Sincere', occasion: 'Thank you', artClass: 'art-sincere', previewClass: 'preview-sincere-card' },
  { id: 'congratulations-bright-01', name: 'Bright future', occasion: 'Congratulations', artClass: 'art-bright', previewClass: 'preview-bright-card' },
  { id: 'love-together-01', name: 'Together', occasion: 'Love', artClass: 'art-together', previewClass: 'preview-together-card' },
  { id: 'just-because-doodle-01', name: 'Doodle day', occasion: 'Just because', artClass: 'art-doodle', previewClass: 'preview-doodle-card' },
]
