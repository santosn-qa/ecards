import { useEffect, useRef, useState } from 'react'
import {
  aiRecipients,
  aiStyles,
  aiTones,
  describeAiError,
  fetchAiStatus,
  generateAiMessage,
  type AiCardSuggestion,
  type AiRecipient,
  type AiStyle,
  type AiTone,
} from '../ai/aiClient'
import { loadTurnstile, type TurnstileApi } from '../ai/turnstile'
import { occasions, type Occasion } from '../data/templates'

export type AiApplied = AiCardSuggestion & { occasion: Occasion }

type AiCreatePanelProps = {
  apiUrl: string
  turnstileSiteKey: string
  initialOccasion: Occasion
  /** True when the editor already holds the user's own words, so we can warn before replacing them. */
  hasTypedMessage: boolean
  onApply: (result: AiApplied) => void
  onApplyMessage: (message: string) => void
  onClose: () => void
}

type Availability = 'checking' | 'available' | 'unavailable' | 'limit-reached'

export function AiCreatePanel({ apiUrl, turnstileSiteKey, initialOccasion, hasTypedMessage, onApply, onApplyMessage, onClose }: AiCreatePanelProps) {
  const [occasion, setOccasion] = useState<Occasion>(initialOccasion)
  const [recipient, setRecipient] = useState<AiRecipient>('friend')
  const [tone, setTone] = useState<AiTone>('heartfelt')
  const [style, setStyle] = useState<AiStyle>('watercolor')
  const [details, setDetails] = useState('')
  const [ownWords, setOwnWords] = useState('')
  const [availability, setAvailability] = useState<Availability>('checking')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [token, setToken] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [hasResult, setHasResult] = useState(false)
  const widgetContainerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<{ api: TurnstileApi; id: string } | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // One status request when the panel opens: never on page load.
  useEffect(() => {
    if (!online) return
    const controller = new AbortController()
    fetchAiStatus(apiUrl, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (!result.ok || !result.value.enabled) return setAvailability('unavailable')
      setRemaining(result.value.signatureRemaining)
      setAvailability(result.value.signatureRemaining > 0 ? 'available' : 'limit-reached')
    })
    return () => controller.abort()
  }, [apiUrl, online])

  // The Turnstile script and widget load only while this panel is open.
  useEffect(() => {
    if (!online) return
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !widgetContainerRef.current) return
        const id = api.render(widgetContainerRef.current, {
          sitekey: turnstileSiteKey,
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (value) => {
            setToken(value)
            setVerificationError(false)
          },
          'error-callback': () => setVerificationError(true),
          'expired-callback': () => setToken(null),
        })
        widgetRef.current = { api, id }
      })
      .catch(() => {
        if (!cancelled) setVerificationError(true)
      })
    return () => {
      cancelled = true
      if (widgetRef.current) widgetRef.current.api.remove(widgetRef.current.id)
      widgetRef.current = null
      setToken(null)
    }
  }, [online, turnstileSiteKey])

  // Cancel any request still running if the panel closes.
  useEffect(() => () => requestRef.current?.abort(), [])

  async function generate(kind: 'new' | 'regenerate') {
    if (!token || generating) return
    const controller = new AbortController()
    requestRef.current = controller
    setGenerating(true)
    setStatus(kind === 'new' ? 'Writing your card…' : 'Writing a new message…')
    const result = await generateAiMessage(
      apiUrl,
      { turnstileToken: token, occasion, recipient, tone, style, personalMessage: ownWords.trim(), extraInstructions: details.trim() },
      controller.signal,
    )
    requestRef.current = null
    setGenerating(false)
    // Turnstile tokens are single-use, so get a fresh one for the next request.
    setToken(null)
    if (widgetRef.current) widgetRef.current.api.reset(widgetRef.current.id)

    if (!result.ok) {
      setStatus(describeAiError(result.error, result.retryAfterSeconds))
      if (result.error === 'daily_limit_reached') {
        setRemaining(0)
        setAvailability('limit-reached')
      }
      if (result.error === 'budget_exhausted' || result.error === 'ai_disabled') setAvailability('unavailable')
      return
    }
    if (result.value.source === 'ai' && remaining !== null) {
      const next = Math.max(0, remaining - 1)
      setRemaining(next)
      if (next === 0) setAvailability('limit-reached')
    }
    if (kind === 'new') onApply({ ...result.value, occasion })
    else onApplyMessage(result.value.message)
    setHasResult(true)
    setStatus(kind === 'new' ? 'Your card is ready below. Edit anything you like.' : 'New message added. Your design and font stay as they are.')
  }

  const usingOwnWords = ownWords.trim().length > 0
  // Your own words cost no AI use, so they still work once today's AI cards are used up.
  const canGenerate = online && Boolean(token) && !generating && (availability === 'available' || (availability === 'limit-reached' && usingOwnWords))
  const availabilityNote =
    availability === 'unavailable'
      ? 'The AI helper isn’t available right now. You can still make a card the usual way below.'
      : availability === 'limit-reached' && !usingOwnWords
        ? 'You’ve used today’s AI cards. Come back tomorrow, or write your own message below.'
        : ''
  const statusText = !online
    ? 'You’re offline. The AI helper needs a connection, but you can still make a card below.'
    : status || availabilityNote

  return (
    <section className="ai-panel" aria-labelledby="ai-panel-title" aria-busy={generating}>
      <div className="ai-panel-heading">
        <div>
          <p className="eyebrow">Optional</p>
          <h2 id="ai-panel-title">Create with AI</h2>
        </div>
        <button className="ai-panel-close" type="button" onClick={onClose} aria-label="Close Create with AI">×</button>
      </div>
      <p className="ai-panel-intro">Tell us a little about the card and we’ll suggest a message, design and font. You can edit everything afterwards.</p>

      <form className="ai-form" onSubmit={(event) => { event.preventDefault(); void generate('new') }}>
        <div className="ai-form-grid">
          <label>Occasion
            <select value={occasion} onChange={(event) => setOccasion(event.target.value as Occasion)}>
              {occasions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Who is it for?
            <select value={recipient} onChange={(event) => setRecipient(event.target.value as AiRecipient)}>
              {aiRecipients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Tone
            <select value={tone} onChange={(event) => setTone(event.target.value as AiTone)}>
              {aiTones.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Look
            <select value={style} onChange={(event) => setStyle(event.target.value as AiStyle)}>
              {aiStyles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <label className="ai-form-wide">
          <span className="field-label-row"><span>Anything to include? <small>optional</small></span><small aria-hidden="true">{details.length}/200</small></span>
          <input value={details} maxLength={200} onChange={(event) => setDetails(event.target.value)} placeholder="e.g. turning 30, loves hiking, thanks for the soup" />
        </label>
        <details className="ai-own-words">
          <summary>Already know what to say?</summary>
          <label className="ai-form-wide">
            <span className="field-label-row"><span>Your own words <small>kept exactly as written</small></span><small aria-hidden="true">{ownWords.length}/500</small></span>
            <textarea value={ownWords} maxLength={500} rows={3} onChange={(event) => setOwnWords(event.target.value)} placeholder="We’ll keep your message and just pick a design and font." />
          </label>
        </details>

        <p className="ai-privacy">
          <span aria-hidden="true">⌁</span> Your choices and message are sent to Cloudflare’s AI service to write your card. Names aren’t sent, and Little Hello doesn’t store any of it.
        </p>
        {hasTypedMessage && !hasResult && <p className="ai-replace-note">This will replace the message you’ve written below.</p>}
        <div ref={widgetContainerRef} className="ai-turnstile" />
        {verificationError && online && <p className="ai-replace-note">The human check didn’t load. Refresh the page to try again.</p>}

        <div className="ai-actions">
          {generating ? (
            <button className="secondary-action" type="button" onClick={() => requestRef.current?.abort()}>Cancel</button>
          ) : (
            <>
              <button className="primary-action" type="submit" disabled={!canGenerate}>
                {usingOwnWords ? 'Pick a design for my words' : hasResult ? 'Write a new card' : 'Write my card'}
              </button>
              {hasResult && !usingOwnWords && (
                <button className="secondary-action" type="button" onClick={() => void generate('regenerate')} disabled={!canGenerate}>Regenerate message</button>
              )}
            </>
          )}
          {remaining !== null && availability !== 'unavailable' && online && (
            <span className="ai-remaining">{remaining} AI {remaining === 1 ? 'card' : 'cards'} left today</span>
          )}
        </div>
        {online && !token && !generating && availability === 'available' && !verificationError && (
          <p className="ai-hint">Getting ready…</p>
        )}
        <p className="ai-status" role="status" aria-live="polite">{statusText}</p>
      </form>
    </section>
  )
}
