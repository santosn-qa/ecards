import type { CardDraft, CardTemplate } from '../data/templates'
import { getMessageFont } from '../data/typography'

type CardRendererProps = {
  card: CardDraft
  template: CardTemplate
  className?: string
}

export function CardRenderer({ card, template, className = '' }: CardRendererProps) {
  const messageFont = getMessageFont(card.messageFont || template.typography.defaultMessageFont)
  return (
    <article className={`card-preview ${template.previewClass} card-style-${template.style} ${className}`}>
      <div className="preview-art" aria-hidden="true">
        <span className="preview-circle" />
        <span className="preview-sun" />
        <span className="preview-flower flower-one">✽</span>
        <span className="preview-flower flower-two">✦</span>
        <span className="preview-ribbon">celebrate</span>
        <span className="preview-scribble">~</span>
      </div>
      <div className="preview-content">
        <p className="preview-tagline">{template.tagline}</p>
        <p className="preview-to">{card.to || 'A little note for you'}</p>
        <p
          className={`preview-message message-font-${messageFont.id}`}
          style={{ fontFamily: messageFont.family, textAlign: template.typography.messageAlignment, maxWidth: template.typography.messageMaxWidth }}
        >
          {card.message || 'Your message will appear here.'}
        </p>
        <p className="preview-from">{card.from ? `— ${card.from}` : 'With a little love'}</p>
      </div>
      <span className="preview-caption" aria-hidden="true">{template.name}</span>
    </article>
  )
}
