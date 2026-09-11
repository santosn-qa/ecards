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
  messageFont?: MessageFontId
}

export type CardTemplate = {
  id: string
  name: string
  occasion: Occasion
  artClass: string
  previewClass: string
  style: 'playful' | 'sunny' | 'editorial' | 'botanical' | 'handmade' | 'celebration' | 'romantic' | 'doodle'
  tagline: string
  typography: {
    defaultMessageFont: MessageFontId
    messageAlignment: 'left' | 'center' | 'right'
    messageMaxWidth: string
  }
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
  { id: 'birthday-confetti-01', name: 'Confetti', occasion: 'Birthday', artClass: 'art-confetti', previewClass: 'preview-confetti-card', style: 'playful', tagline: 'Make a little noise', typography: { defaultMessageFont: 'caveat', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'birthday-sunshine-01', name: 'Sunshine', occasion: 'Birthday', artClass: 'art-sunshine', previewClass: 'preview-sunshine-card', style: 'sunny', tagline: 'A bright day for you', typography: { defaultMessageFont: 'quicksand', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'birthday-party-01', name: 'Party time', occasion: 'Birthday', artClass: 'art-party', previewClass: 'preview-party-card', style: 'celebration', tagline: 'Today is worth celebrating', typography: { defaultMessageFont: 'dancing-script', messageAlignment: 'center', messageMaxWidth: '90%' } },
  { id: 'thank-you-bloom-01', name: 'Bloom', occasion: 'Thank you', artClass: 'art-bloom', previewClass: 'preview-bloom-card', style: 'botanical', tagline: 'Thank you, truly', typography: { defaultMessageFont: 'satisfy', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'thank-you-sincere-01', name: 'Sincere', occasion: 'Thank you', artClass: 'art-sincere', previewClass: 'preview-sincere-card', style: 'editorial', tagline: 'With all my gratitude', typography: { defaultMessageFont: 'cormorant', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'congratulations-bright-01', name: 'Bright future', occasion: 'Congratulations', artClass: 'art-bright', previewClass: 'preview-bright-card', style: 'celebration', tagline: 'Look how far you’ve come', typography: { defaultMessageFont: 'dm-serif', messageAlignment: 'center', messageMaxWidth: '92%' } },
  { id: 'love-together-01', name: 'Together', occasion: 'Love', artClass: 'art-together', previewClass: 'preview-together-card', style: 'romantic', tagline: 'Better together', typography: { defaultMessageFont: 'dancing-script', messageAlignment: 'center', messageMaxWidth: '90%' } },
  { id: 'just-because-doodle-01', name: 'Doodle day', occasion: 'Just because', artClass: 'art-doodle', previewClass: 'preview-doodle-card', style: 'doodle', tagline: 'A happy little surprise', typography: { defaultMessageFont: 'caveat', messageAlignment: 'left', messageMaxWidth: '88%' } },
]
import type { MessageFontId } from './typography'
