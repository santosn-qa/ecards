import type { CardDraft, CardTemplate } from '../data/templates'

type CardRendererProps = {
  card: CardDraft
  template: CardTemplate
  className?: string
}

export function CardRenderer({ card, template, className = '' }: CardRendererProps) {
  return (
    <article className={`card-preview ${template.previewClass} ${className}`}>
      <div className="preview-art" aria-hidden="true">
        <span className="preview-circle" />
        <span className="preview-confetti">✦</span>
        <span className="preview-confetti second">✧</span>
      </div>
      <div className="preview-content">
        <p className="preview-to">{card.to || 'A little note for you'}</p>
        <p className="preview-message">{card.message || 'Your message will appear here.'}</p>
        <p className="preview-from">{card.from ? `— ${card.from}` : 'With a little love'}</p>
      </div>
    </article>
  )
}
