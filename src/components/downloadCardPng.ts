import type { CardDraft, CardTemplate } from '../data/templates'
import { getMessageFont } from '../data/typography'

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)
}

function wrapMessage(value: string, maxCharacters = 28) {
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
  }).slice(0, 5)
}

export async function downloadCardPng(card: CardDraft, template: CardTemplate) {
  const width = 1080
  const height = 1350
  const messageLines = wrapMessage(card.message || 'Your message will appear here.', card.message && card.message.length > 100 ? 34 : 28)
  const messageSize = messageLines.length > 3 ? 56 : 68
  const message = messageLines.map((line, index) => `<tspan x="140" dy="${index ? messageSize * 1.15 : 0}">${escapeXml(line)}</tspan>`).join('')
  const to = escapeXml(card.to || 'A little note for you')
  const from = escapeXml(card.from ? `— ${card.from}` : 'With a little love')
  const messageFont = getMessageFont(card.messageFont || template.typography.defaultMessageFont)
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
  const [background, circle] = colors[template.previewClass] ?? colors['preview-confetti-card']
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="1080" height="1350" fill="${background}"/>
    <circle cx="920" cy="180" r="390" fill="${circle}"/>
    <text x="140" y="300" fill="white" opacity=".82" font-family="Arial,sans-serif" font-size="24">${escapeXml(template.tagline)}</text>
    <text x="140" y="390" fill="white" font-family="Arial,sans-serif" font-size="30">${to}</text>
    <text x="140" y="640" fill="white" font-family="${escapeXml(messageFont.family)}" font-size="${messageSize}">${message}</text>
    <text x="140" y="1140" fill="white" font-family="Arial,sans-serif" font-size="30">${from}</text>
    <text x="140" y="220" fill="white" font-family="Arial,sans-serif" font-size="54">✦</text>
    <text x="270" y="380" fill="#e77955" font-family="Arial,sans-serif" font-size="36">✧</text>
  </svg>`
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Unable to render card image'))
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  context.drawImage(image, 0, 0)
  const link = document.createElement('a')
  link.download = `little-hello-${template.id}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
