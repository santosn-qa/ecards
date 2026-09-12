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

export type ArtworkSpec = {
  asset?: string
  /** 'full-bleed' assets are complete illustrations rendered edge-to-edge with no additional decoration drawn on top. */
  illustrationStyle?: 'full-bleed'
  focalPoint: 'lower-right' | 'upper-right' | 'left' | 'full-bleed'
  messageSafeArea: { x: number; y: number; width: number; height: number }
  backgroundColor: string
  messageColor: string
  supportingTextColor: string
}

export type CardTemplate = {
  id: string
  name: string
  occasion: Occasion
  previewClass: string
  style: 'playful' | 'sunny' | 'editorial' | 'botanical' | 'handmade' | 'celebration' | 'romantic' | 'doodle'
  collection: 'botanical' | 'celebration' | 'artistic'
  tagline: string
  artwork: ArtworkSpec
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
  { id: 'birthday-confetti-01', name: 'Birthday Garden', occasion: 'Birthday', previewClass: 'preview-confetti-card', style: 'playful', collection: 'celebration', tagline: 'Make a little noise', artwork: { asset: 'celebration-cake-ribbon.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#F6F0E4', messageColor: '#4A3B32', supportingTextColor: '#8A6F55' }, typography: { defaultMessageFont: 'caveat', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'birthday-sunshine-01', name: 'Sunshine', occasion: 'Birthday', previewClass: 'preview-sunshine-card', style: 'sunny', collection: 'celebration', tagline: 'A bright day for you', artwork: { asset: 'botanical-pressed-bouquet.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#F5EFE1', messageColor: '#4A3B2E', supportingTextColor: '#8A7055' }, typography: { defaultMessageFont: 'quicksand', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'birthday-party-01', name: 'Party time', occasion: 'Birthday', previewClass: 'preview-party-card', style: 'celebration', collection: 'celebration', tagline: 'Today is worth celebrating', artwork: { asset: 'artistic-midnight-bouquet.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#F4EEE0', messageColor: '#46332A', supportingTextColor: '#7A5B4A' }, typography: { defaultMessageFont: 'dancing-script', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'thank-you-bloom-01', name: 'Bloom', occasion: 'Thank you', previewClass: 'preview-bloom-card', style: 'botanical', collection: 'botanical', tagline: 'Thank you, truly', artwork: { asset: 'botanical-gift-letter.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#F7F1E6', messageColor: '#493C34', supportingTextColor: '#8A6F55' }, typography: { defaultMessageFont: 'satisfy', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'thank-you-sincere-01', name: 'Sincere', occasion: 'Thank you', previewClass: 'preview-sincere-card', style: 'editorial', collection: 'botanical', tagline: 'With all my gratitude', artwork: { asset: 'botanical-envelope-note.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#F2ECE0', messageColor: '#493C34', supportingTextColor: '#725747' }, typography: { defaultMessageFont: 'cormorant', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'congratulations-bright-01', name: 'Bright future', occasion: 'Congratulations', previewClass: 'preview-bright-card', style: 'celebration', collection: 'celebration', tagline: 'Look how far you’ve come', artwork: { asset: 'celebration-bouquet-toast.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#FAF1E6', messageColor: '#4A3B2E', supportingTextColor: '#8A6F55' }, typography: { defaultMessageFont: 'dm-serif', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'love-together-01', name: 'Together', occasion: 'Love', previewClass: 'preview-together-card', style: 'romantic', collection: 'artistic', tagline: 'Better together', artwork: { asset: 'romantic-morning-mugs.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#F7F1E6', messageColor: '#4A3B32', supportingTextColor: '#8A6F55' }, typography: { defaultMessageFont: 'dancing-script', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'love-letter-01', name: 'Love letter', occasion: 'Love', previewClass: 'preview-love-letter-card', style: 'romantic', collection: 'artistic', tagline: 'Written just for you', artwork: { asset: 'romantic-love-letter.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#F8F1E9', messageColor: '#4A3B32', supportingTextColor: '#8A6F55' }, typography: { defaultMessageFont: 'satisfy', messageAlignment: 'left', messageMaxWidth: '88%' } },
  { id: 'just-because-doodle-01', name: 'Doodle day', occasion: 'Just because', previewClass: 'preview-doodle-card', style: 'doodle', collection: 'artistic', tagline: 'A happy little surprise', artwork: { asset: 'whimsical-gardenia-ribbon.jpg', illustrationStyle: 'full-bleed', focalPoint: 'lower-right', messageSafeArea: { x: 40, y: 40, width: 260, height: 420 }, backgroundColor: '#FBF1E7', messageColor: '#4A3B32', supportingTextColor: '#8A6F55' }, typography: { defaultMessageFont: 'caveat', messageAlignment: 'left', messageMaxWidth: '88%' } },
]
import type { MessageFontId } from './typography'
