import type { CardDraft, CardTemplate } from '../data/templates'
import { getMessageFont, type MessageFontId } from '../data/typography'
import caveatFontUrl from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url'
import cormorantFontUrl from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2?url'
import dancingScriptFontUrl from '@fontsource/dancing-script/files/dancing-script-latin-400-normal.woff2?url'
import dmSerifFontUrl from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url'
import libreBaskervilleFontUrl from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2?url'
import quicksandFontUrl from '@fontsource/quicksand/files/quicksand-latin-400-normal.woff2?url'
import satisfyFontUrl from '@fontsource/satisfy/files/satisfy-latin-400-normal.woff2?url'
import spaceGroteskFontUrl from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url'

const supportingFontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const exportFontSources: Record<MessageFontId, { family: string; url: string }> = {
  caveat: { family: 'Caveat', url: caveatFontUrl },
  'dancing-script': { family: 'Dancing Script', url: dancingScriptFontUrl },
  cormorant: { family: 'Cormorant Garamond', url: cormorantFontUrl },
  'dm-serif': { family: 'DM Serif Display', url: dmSerifFontUrl },
  'libre-baskerville': { family: 'Libre Baskerville', url: libreBaskervilleFontUrl },
  quicksand: { family: 'Quicksand', url: quicksandFontUrl },
  satisfy: { family: 'Satisfy', url: satisfyFontUrl },
  'space-grotesk': { family: 'Space Grotesk', url: spaceGroteskFontUrl },
}

const fontDataUrlCache = new Map<MessageFontId, Promise<string>>()

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `${r},${g},${b}`
}

async function loadArtworkBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Unable to fetch artwork image')
  return createImageBitmap(await response.blob())
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read font file'))
    reader.readAsDataURL(blob)
  })
}

async function getFontDataUrl(fontId: MessageFontId) {
  const existing = fontDataUrlCache.get(fontId)
  if (existing) return existing

  const fontDataUrl = fetch(exportFontSources[fontId].url)
    .then((response) => {
      if (!response.ok) throw new Error('Unable to fetch message font')
      return response.blob()
    })
    .then(blobToDataUrl)

  fontDataUrlCache.set(fontId, fontDataUrl)
  return fontDataUrl
}

async function createFontFaceCss(fontId: MessageFontId) {
  const fontSource = exportFontSources[fontId]
  const fontDataUrl = await getFontDataUrl(fontId)
  return `@font-face{font-family:"${fontSource.family}";font-style:normal;font-weight:400;src:url("${fontDataUrl}") format("woff2");}`
}

function drawArtworkCover(context: CanvasRenderingContext2D, bitmap: ImageBitmap, width: number, height: number) {
  const scale = Math.max(width / bitmap.width, height / bitmap.height)
  const drawWidth = bitmap.width * scale
  const drawHeight = bitmap.height * scale
  context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function wrapMessage(value: string, maxCharacters = 28, maxLines = 5) {
  return value.split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) return ['']
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      if (line && `${line} ${word}`.length > maxCharacters) {
        lines.push(line)
        line = word
      } else {
        line = line ? `${line} ${word}` : word
      }
    }
    if (line) lines.push(line)
    return lines
  }).slice(0, maxLines)
}

export async function downloadCardPng(card: CardDraft, template: CardTemplate) {
  const width = 1080
  const height = 1350
  const isFullBleed = template.artwork.illustrationStyle === 'full-bleed'
  const maxCharacters = isFullBleed ? 20 : (card.message && card.message.length > 100 ? 34 : 28)
  const maxLines = isFullBleed ? 9 : 5
  const messageLines = wrapMessage(card.message || 'Your message will appear here.', maxCharacters, maxLines)
  const messageSize = isFullBleed
    ? (messageLines.length > 7 ? 26 : messageLines.length > 5 ? 32 : messageLines.length > 3 ? 38 : 44)
    : (messageLines.length > 3 ? 56 : 68)
  const messageX = isFullBleed ? 80 : 140
  const message = messageLines.map((line, index) => `<tspan x="${messageX}" dy="${index ? messageSize * 1.15 : 0}">${escapeXml(line)}</tspan>`).join('')
  const to = escapeXml(card.to || 'A little note for you')
  const from = escapeXml(card.from ? `— ${card.from}` : 'With a little love')
  const messageFont = getMessageFont(card.messageFont || template.typography.defaultMessageFont)
  const messageFontCss = await createFontFaceCss(messageFont.id)
  const colors: Record<string, [string, string]> = {
    'preview-confetti-card': ['#f2c9c0', '#f8d18c'],
    'preview-sunshine-card': ['#d7ad54', '#f8e0a1'],
    'preview-party-card': ['#7897b4', '#f19a79'],
    'preview-bloom-card': ['#b7797a', '#f3d9ca'],
    'preview-sincere-card': ['#998979', '#e7ddce'],
    'preview-bright-card': ['#679e91', '#f3c776'],
    'preview-together-card': ['#a77587', '#e8c3cc'],
    'preview-doodle-card': ['#c7944f', '#fae0a8'],
  }
  const [, accent] = colors[template.previewClass] ?? colors['preview-confetti-card']
  const messageColor = template.artwork.messageColor
  const supportingColor = template.artwork.supportingTextColor
  const artworkPath = template.artwork.asset ?? ''
  const artwork = isFullBleed
    ? ''
    : template.collection === 'botanical'
      ? `<rect width="1080" height="1350" fill="#efe1c9"/><rect x="62" y="62" width="956" height="1226" fill="none" stroke="#8a6750" stroke-width="2" stroke-dasharray="3 8"/><path d="M-30 1270C140 1010 120 650 380 300M20 1290C250 1160 300 820 280 470" fill="none" stroke="#607b55" stroke-width="7"/><g fill="#819b68"><ellipse cx="190" cy="980" rx="38" ry="92" transform="rotate(-48 190 980)"/><ellipse cx="140" cy="760" rx="32" ry="82" transform="rotate(48 140 760)"/><ellipse cx="260" cy="560" rx="29" ry="72" transform="rotate(-52 260 560)"/></g><g fill="#b9675d" stroke="#814a48" stroke-width="2"><circle cx="390" cy="280" r="54"/><circle cx="390" cy="280" r="20"/></g>`
      : template.collection === 'celebration'
        ? `<rect width="1080" height="1350" fill="#e77d62"/><path d="M-40 190C160 40 300 280 490 130s280-10 650 40" fill="none" stroke="#f6cf78" stroke-width="28"/><path d="M300-20c18 180 210 180 130 420s160 250 70 490" fill="none" stroke="#9cb9ce" stroke-width="18"/><g fill="#f5ce77"><path d="M120 320l45-14 14 45-45 14z"/><circle cx="960" cy="330" r="15"/><path d="M860 620l56-34 34 56-56 34z"/></g><rect x="554" y="638" width="594" height="684" fill="#f5ead7" stroke="#b77659" stroke-width="5"/>`
        : `<rect width="1080" height="1350" fill="#202a3d"/><path d="M860 150a210 210 0 1 0-98 380A235 235 0 1 1 860 150z" fill="#e4bd78"/><path d="M-40 1170c260-300 410-10 650-220 210-185 390-100 520 45v400H-40z" fill="#35465a"/><path d="M-40 1260c210-220 390-160 600-35 210 125 340-10 570-170v300H-40z" fill="#172235"/><path d="M-20 1190C190 1080 220 850 350 620" fill="none" stroke="#9bb18c" stroke-width="8"/>`
  const decorativeGlyphs = isFullBleed ? '' : `
    <text x="140" y="220" fill="${supportingColor}" font-family="Arial,sans-serif" font-size="54">✦</text>
    <text x="270" y="380" fill="#e77955" font-family="Arial,sans-serif" font-size="36">✧</text>`
  const washRgb = hexToRgb(template.artwork.backgroundColor)
  const textWash = isFullBleed
    ? `<defs><style>${messageFontCss}</style><linearGradient id="text-wash" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgb(${washRgb})" stop-opacity=".97"/>
        <stop offset="48%" stop-color="rgb(${washRgb})" stop-opacity=".88"/>
        <stop offset="82%" stop-color="rgb(${washRgb})" stop-opacity="0"/>
      </linearGradient></defs>
      <rect width="${width}" height="${height}" fill="url(#text-wash)"/>`
    : `<defs><style>${messageFontCss}</style></defs>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${artwork}
    ${textWash}
    ${isFullBleed ? '' : `<rect width="1080" height="1350" fill="${accent}" opacity=".06"/>`}
    <text x="${messageX}" y="${isFullBleed ? 150 : 300}" fill="${supportingColor}" opacity=".82" font-family="${escapeXml(supportingFontFamily)}" font-size="${isFullBleed ? 22 : 24}">${escapeXml(template.tagline)}</text>
    <text x="${messageX}" y="${isFullBleed ? 220 : 390}" fill="${messageColor}" font-family="${escapeXml(supportingFontFamily)}" font-size="${isFullBleed ? 26 : 30}">${to}</text>
    <text x="${messageX}" y="${isFullBleed ? 320 : 640}" fill="${messageColor}" font-family="${escapeXml(messageFont.family)}" font-size="${messageSize}">${message}</text>
    <text x="${messageX}" y="${isFullBleed ? 1220 : 1140}" fill="${isFullBleed ? messageColor : supportingColor}" font-weight="${isFullBleed ? 600 : 400}" font-family="${escapeXml(supportingFontFamily)}" font-size="${isFullBleed ? 28 : 30}">${from}</text>${decorativeGlyphs}
  </svg>`
  const artworkBitmap = isFullBleed
    ? await loadArtworkBitmap(`${window.location.origin}${import.meta.env.BASE_URL}artwork/${artworkPath}`)
    : null
  const overlayImage = new Image()
  overlayImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await new Promise<void>((resolve, reject) => {
    overlayImage.onload = () => resolve()
    overlayImage.onerror = () => reject(new Error('Unable to render card image'))
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  if (artworkBitmap) drawArtworkCover(context, artworkBitmap, width, height)
  context.drawImage(overlayImage, 0, 0)
  const link = document.createElement('a')
  link.download = `little-hello-${template.id}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
