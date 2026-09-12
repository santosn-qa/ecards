import { SUPPORT_CONFIG } from '../config/support'

type SupportPanelProps = {
  onDismiss: () => void
}

export function SupportPanel({ onDismiss }: SupportPanelProps) {
  return (
    <div className="support-panel" role="region" aria-label="Support Little Hello prompt">
      <p className="support-panel-heading">
        <span aria-hidden="true">💌</span> Send a little love back
      </p>
      <p className="support-panel-body">
        Little Hello is free, with no ads or paywalls. If this helped you make
        someone’s day a little brighter, you can help keep Little Hello going.
      </p>
      <p className="support-panel-privacy">
        We never see your card, your message, or any personal details — this
        just opens Ko-fi in a new tab.
      </p>
      <div className="support-panel-actions">
        <a
          className="primary-action"
          href={SUPPORT_CONFIG.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDismiss}
        >
          Support Little Hello
        </a>
        <button type="button" className="secondary-action" aria-label="Dismiss support message" onClick={onDismiss}>
          No thanks
        </button>
      </div>
    </div>
  )
}
