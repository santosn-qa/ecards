export type MessageFontId =
  | 'caveat'
  | 'dancing-script'
  | 'cormorant'
  | 'dm-serif'
  | 'libre-baskerville'
  | 'quicksand'
  | 'satisfy'
  | 'space-grotesk'

export type MessageFontOption = {
  id: MessageFontId
  name: string
  category: string
  family: string
  sample: string
}

export const messageFonts: MessageFontOption[] = [
  { id: 'caveat', name: 'Caveat', category: 'Handwritten', family: '"Caveat", "Segoe Print", cursive', sample: 'Warm & personal' },
  { id: 'dancing-script', name: 'Dancing Script', category: 'Romantic', family: '"Dancing Script", "Brush Script MT", cursive', sample: 'Softly joyful' },
  { id: 'cormorant', name: 'Cormorant', category: 'Elegant', family: '"Cormorant Garamond", Georgia, serif', sample: 'Quietly beautiful' },
  { id: 'dm-serif', name: 'DM Serif', category: 'Classic', family: '"DM Serif Display", Georgia, serif', sample: 'Make it memorable' },
  { id: 'libre-baskerville', name: 'Libre Baskerville', category: 'Traditional', family: '"Libre Baskerville", Georgia, serif', sample: 'With all my heart' },
  { id: 'quicksand', name: 'Quicksand', category: 'Friendly', family: '"Quicksand", "Trebuchet MS", sans-serif', sample: 'A little sunshine' },
  { id: 'satisfy', name: 'Satisfy', category: 'Handmade', family: '"Satisfy", "Brush Script MT", cursive', sample: 'Made with love' },
  { id: 'space-grotesk', name: 'Space Grotesk', category: 'Modern', family: '"Space Grotesk", "Trebuchet MS", sans-serif', sample: 'Bright days ahead' },
]

export const defaultMessageFont: MessageFontId = 'cormorant'

export function getMessageFont(id: string | undefined) {
  return messageFonts.find((font) => font.id === id) ?? messageFonts.find((font) => font.id === defaultMessageFont)!
}
