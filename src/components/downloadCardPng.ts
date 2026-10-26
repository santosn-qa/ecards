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

const fontLoadCache = new Map<MessageFontId, Promise<void>>()

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

async function ensureExportFontLoaded(fontId: MessageFontId) {
  const existing = fontLoadCache.get(fontId)
  if (existing) return existing

  const fontSource = exportFontSources[fontId]
  const fontLoad = new FontFace(fontSource.family, `url(${fontSource.url})`, { style: 'normal', weight: '400' })
    .load()
    .then((loadedFont) => {
      document.fonts.add(loadedFont)
    })

  fontLoadCache.set(fontId, fontLoad)
  return fontLoad
}

function setCanvasFont(context: CanvasRenderingContext2D, weight: number, size: number, family: string) {
  context.font = `${weight} ${size}px ${family}`
}

function drawTrackedText(context: CanvasRenderingContext2D, value: string, x: number, y: number, tracking: number) {
  let cursorX = x
  for (const character of value) {
    context.fillText(character, cursorX, y)
    cursorX += context.measureText(character).width + tracking
  }
}

function drawTextLines(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => {
    context.fillText(line, x, y + (index * lineHeight))
  })
}

function drawArtworkCover(context: CanvasRenderingContext2D, bitmap: ImageBitmap, width: number, height: number) {
  const scale = Math.max(width / bitmap.width, height / bitmap.height)
  const drawWidth = bitmap.width * scale
  const drawHeight = bitmap.height * scale
  context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

// Mirrors the on-screen preview, which collapses newlines and breaks overlong words (overflow-wrap: anywhere).
function wrapMessage(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ''
    for (const character of word) {
      if (line && context.measureText(line + character).width > maxWidth) {
        lines.push(line)
        line = ''
      }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

// Picks the largest font size whose wrapped lines fit the message area, so long messages shrink instead of being cut off.
function fitMessage(context: CanvasRenderingContext2D, value: string, family: string, maxWidth: number, maxHeight: number, maxSize: number, lineHeightRatio: number) {
  for (let size = maxSize; size > 12; size -= 2) {
    setCanvasFont(context, 400, size, family)
    const lines = wrapMessage(context, value, maxWidth)
    if (lines.length * size * lineHeightRatio <= maxHeight) return { lines, size }
  }
  setCanvasFont(context, 400, 12, family)
  return { lines: wrapMessage(context, value, maxWidth), size: 12 }
}

export async function downloadCardPng(card: CardDraft, template: CardTemplate) {
  const width = 1080
  const height = 1350
  const isFullBleed = template.artwork.illustrationStyle === 'full-bleed'
  const messageX = isFullBleed ? 80 : 140
  const to = card.to || 'A little note for you'
  const from = card.from ? `— ${card.from}` : 'With a little love'
  const messageFont = getMessageFont(card.messageFont || template.typography.defaultMessageFont)
  await ensureExportFontLoaded(messageFont.id)
  await document.fonts.ready
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
    ? `<defs><linearGradient id="text-wash" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgb(${washRgb})" stop-opacity=".97"/>
        <stop offset="48%" stop-color="rgb(${washRgb})" stop-opacity=".88"/>
        <stop offset="82%" stop-color="rgb(${washRgb})" stop-opacity="0"/>
      </linearGradient></defs>
      <rect width="${width}" height="${height}" fill="url(#text-wash)"/>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${artwork}
    ${textWash}
    ${isFullBleed ? '' : `<rect width="1080" height="1350" fill="${accent}" opacity=".06"/>`}
    ${decorativeGlyphs}
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

  context.textBaseline = 'alphabetic'
  context.fillStyle = supportingColor
  context.globalAlpha = 0.82
  setCanvasFont(context, 400, isFullBleed ? 22 : 24, supportingFontFamily)
  drawTrackedText(context, template.tagline.toUpperCase(), messageX, isFullBleed ? 150 : 300, (isFullBleed ? 22 : 24) * 0.12)

  context.globalAlpha = 1
  context.fillStyle = messageColor
  setCanvasFont(context, isFullBleed ? 600 : 400, isFullBleed ? 26 : 30, supportingFontFamily)
  context.fillText(to, messageX, isFullBleed ? 220 : 390)

  // Full-bleed message column matches the preview: 66% content width, 8% left padding, 88% message max-width.
  const messageMaxWidth = isFullBleed ? 550 : width - (messageX * 2)
  const messageTop = isFullBleed ? 270 : 590
  const messageBottom = isFullBleed ? 1150 : 1070
  const lineHeightRatio = isFullBleed ? 1.26 : 1.15
  const { lines: messageLines, size: messageSize } = fitMessage(
    context,
    card.message || 'Your message will appear here.',
    messageFont.family,
    messageMaxWidth,
    messageBottom - messageTop,
    isFullBleed ? 44 : 68,
    lineHeightRatio,
  )
  drawTextLines(context, messageLines, messageX, messageTop + messageSize, messageSize * lineHeightRatio)

  context.fillStyle = isFullBleed ? messageColor : supportingColor
  setCanvasFont(context, isFullBleed ? 600 : 400, isFullBleed ? 28 : 30, supportingFontFamily)
  context.fillText(from, messageX, isFullBleed ? 1220 : 1140)

  const link = document.createElement('a')
  link.download = `little-hello-${template.id}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
