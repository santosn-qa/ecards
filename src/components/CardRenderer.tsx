import type { CSSProperties } from 'react'
import type { CardDraft, CardTemplate } from '../data/templates'
import { getMessageFont } from '../data/typography'
import { AiArtwork, CardArtwork } from './CardArtwork'

type CardRendererProps = {
  card: CardDraft
  template: CardTemplate
  className?: string
  /** A local blob: URL for an AI illustration. When set, the card uses the "illustration above text" layout. */
  artworkUrl?: string
}

export function CardRenderer({ card, template, className = '', artworkUrl }: CardRendererProps) {
  const messageFont = getMessageFont(card.messageFont || template.typography.defaultMessageFont)
  const messageLength = (card.message || '').length
  const lengthClass = messageLength > 200 ? 'message-length-xlong' : messageLength > 120 ? 'message-length-long' : ''
  return (
    <article
      className={`card-preview ${template.previewClass} card-style-${template.style} card-collection-${template.collection} ${artworkUrl ? 'card-layout-ai-top' : ''} ${className}`}
      style={artworkUrl ? ({ '--panel-color': template.artwork.backgroundColor } as CSSProperties) : undefined}
    >
      <div className="preview-art" aria-hidden="true">
        {artworkUrl ? <AiArtwork url={artworkUrl} /> : <CardArtwork template={template} />}
      </div>
      <div
        className="preview-content"
        style={{
          color: template.artwork.messageColor,
          '--supporting-text-color': template.artwork.supportingTextColor,
        } as CSSProperties}
      >
        <p className="preview-tagline">{template.tagline}</p>
        <p className="preview-to">{card.to || 'A little note for you'}</p>
        <p
          className={`preview-message message-font-${messageFont.id} ${lengthClass}`.trim()}
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
