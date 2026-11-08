import { useMemo, useState } from 'react'
import { getOccasion } from '../data/occasionLibrary'
import { findMessages } from '../messages/findMessages'

const PAGE_SIZE = 4

type MessageChooserProps = {
  recipientIds: string[]
  occasionId: string | null
  /** True when the editor holds words the user typed, so we ask before replacing them. */
  hasTypedMessage: boolean
  onUse: (text: string) => void
}

/** Ready-made messages for the chosen person and occasion, a few at a time, each with one clear button. */
export function MessageChooser({ recipientIds, occasionId, hasTypedMessage, onUse }: MessageChooserProps) {
  const results = useMemo(() => findMessages({ recipientIds, occasionId: occasionId ?? undefined }), [recipientIds, occasionId])
  const [shown, setShown] = useState(PAGE_SIZE)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const visible = results.messages.slice(0, shown)
  const relatedLabel = results.usedRelatedOccasion && results.occasionId ? getOccasion(results.occasionId)?.label : undefined

  function use(id: string, text: string) {
    if (hasTypedMessage && confirmingId !== id) {
      setConfirmingId(id)
      return
    }
    setConfirmingId(null)
    onUse(text)
  }

  if (results.messages.length === 0) {
    return (
      <div className="message-chooser">
        <p className="message-chooser-empty">We don’t have ready-made messages for this yet. You can write your own in the message box below.</p>
      </div>
    )
  }

  return (
    <div className="message-chooser" aria-label="Ready-made messages" role="region">
      {relatedLabel && <p className="message-chooser-note">Here are some “{relatedLabel}” messages that fit well.</p>}
      {results.broadenedRecipient && <p className="message-chooser-note">These messages suit anyone.</p>}
      <ul className="message-list">
        {visible.map((message) => (
          <li className="message-card" key={message.id}>
            <p className="message-card-text">{message.text}</p>
            {confirmingId === message.id ? (
              <div className="message-card-confirm" role="group" aria-label="Replace your message?">
                <p>This will replace the message you wrote. Use this one instead?</p>
                <button type="button" className="primary-action" onClick={() => use(message.id, message.text)}>Yes, use this message</button>
                <button type="button" className="secondary-action" onClick={() => setConfirmingId(null)}>Keep my message</button>
              </div>
            ) : (
              <button type="button" className="primary-action message-card-use" onClick={() => use(message.id, message.text)}>Use This Message</button>
            )}
          </li>
        ))}
      </ul>
      {shown < results.messages.length && (
        <button type="button" className="secondary-action message-show-more" onClick={() => setShown((count) => count + PAGE_SIZE)}>
          Show more messages ({results.messages.length - shown} more)
        </button>
      )}
    </div>
  )
}
