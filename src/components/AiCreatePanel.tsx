import { useEffect, useRef, useState } from 'react'
import {
  aiLooks,
  aiRecipients,
  describeAiError,
  fetchAiStatus,
  generateAiIllustration,
  generateAiMessage,
  toneForRecipient,
  type AiCardSuggestion,
  type AiErrorCode,
  type AiLook,
  type AiRecipient,
} from '../ai/aiClient'
import { loadTurnstile, type TurnstileApi } from '../ai/turnstile'
import type { Occasion } from '../data/templates'

export type AiApplied = AiCardSuggestion & { occasion: Occasion }
export type AiIllustrationApplied = { blob: Blob; occasion: Occasion }

type AiCreatePanelProps = {
  apiUrl: string
  turnstileSiteKey: string
  /** The occasion chosen on the main page (step 01). */
  occasion: Occasion
  /** True when the editor already holds the user's own words, so we can warn before replacing them. */
  hasTypedMessage: boolean
  onApply: (result: AiApplied) => void
  onApplyMessage: (message: string) => void
  /** Called with a validated JPEG; the app shows it from a local blob: URL. */
  onApplyIllustration: (result: AiIllustrationApplied) => void
  onClose: () => void
}

type Availability = 'checking' | 'available' | 'unavailable' | 'limit-reached'
type Phase = 'idle' | 'writing' | 'painting'

const TOKEN_WAIT_MS = 15_000

/**
 * "Make a card for me": one simple step for anyone. Pick who it's for and a
 * look, optionally add a detail, and press one button. It writes the message,
 * then paints a matching picture when one is available today; otherwise the
 * card keeps a Little Hello design. Everything lands in the normal editor.
 */
export function AiCreatePanel({ apiUrl, turnstileSiteKey, occasion, hasTypedMessage, onApply, onApplyMessage, onApplyIllustration, onClose }: AiCreatePanelProps) {
  const [recipient, setRecipient] = useState<AiRecipient>('friend')
  const [look, setLook] = useState<AiLook>('botanical')
  const [details, setDetails] = useState('')
  const [availability, setAvailability] = useState<Availability>('checking')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [creativeRemaining, setCreativeRemaining] = useState(0)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [verificationError, setVerificationError] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [hasResult, setHasResult] = useState(false)
  const widgetContainerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<{ api: TurnstileApi; id: string } | null>(null)
  const tokenRef = useRef<string | null>(null)
  const waiterRef = useRef<((token: string) => void) | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const busy = phase !== 'idle'

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
      setCreativeRemaining(result.value.creativeRemaining)
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
            setVerificationError(false)
            if (waiterRef.current) {
              const resolve = waiterRef.current
              waiterRef.current = null
              resolve(value)
            } else {
              tokenRef.current = value
            }
          },
          'error-callback': () => setVerificationError(true),
          'expired-callback': () => {
            tokenRef.current = null
          },
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
      tokenRef.current = null
      waiterRef.current = null
    }
  }, [online, turnstileSiteKey])

  // Cancel any request still running if the panel closes.
  useEffect(() => () => requestRef.current?.abort(), [])

  /** Takes the current single-use token (or waits for the next one) and asks Turnstile for a fresh one straight away. */
  function nextToken(signal: AbortSignal): Promise<string | null> {
    const take = (token: string) => {
      tokenRef.current = null
      if (widgetRef.current) widgetRef.current.api.reset(widgetRef.current.id)
      return token
    }
    if (tokenRef.current) return Promise.resolve(take(tokenRef.current))
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiterRef.current = null
        resolve(null)
      }, TOKEN_WAIT_MS)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        waiterRef.current = null
        resolve(null)
      })
      waiterRef.current = (token) => {
        clearTimeout(timer)
        resolve(take(token))
      }
    })
  }

  function fail(error: AiErrorCode, retryAfterSeconds?: number) {
    setStatus(describeAiError(error, retryAfterSeconds))
    if (error === 'daily_limit_reached') {
      setRemaining(0)
      setAvailability('limit-reached')
    }
    if (error === 'budget_exhausted' || error === 'ai_disabled') setAvailability('unavailable')
  }

  async function writeMessage(signal: AbortSignal) {
    const token = await nextToken(signal)
    if (signal.aborted) return null
    if (!token) {
      fail('verification_unavailable')
      return null
    }
    const result = await generateAiMessage(
      apiUrl,
      { turnstileToken: token, occasion, recipient, tone: toneForRecipient(recipient, occasion), style: look, personalMessage: '', extraInstructions: details.trim() },
      signal,
    )
    if (!result.ok) {
      fail(result.error, result.retryAfterSeconds)
      return null
    }
    setRemaining((current) => {
      const next = current === null ? current : Math.max(0, current - 1)
      if (next === 0) setAvailability('limit-reached')
      return next
    })
    return result.value
  }

  async function makeCard() {
    if (busy) return
    const controller = new AbortController()
    requestRef.current = controller
    setPhase('writing')
    setStatus('Writing your message…')
    const suggestion = await writeMessage(controller.signal)
    if (!suggestion) {
      requestRef.current = null
      setPhase('idle')
      return
    }
    onApply({ ...suggestion, occasion })
    setHasResult(true)

    let pictureNote = ''
    if (creativeRemaining > 0) {
      setPhase('painting')
      setStatus('Your message is ready. Now painting a picture to match… this can take up to half a minute.')
      const token = await nextToken(controller.signal)
      const picture = token ? await generateAiIllustration(apiUrl, { turnstileToken: token, occasion, style: look }, controller.signal) : null
      if (picture?.ok) {
        onApplyIllustration({ blob: picture.value.blob, occasion })
        setCreativeRemaining((current) => Math.max(0, current - 1))
      } else if (!controller.signal.aborted) {
        // The card is already complete with a Little Hello design, so this is a gentle note, not an error.
        pictureNote = ' We used a Little Hello design for the picture.'
        if (picture && !picture.ok && (picture.error === 'daily_limit_reached' || picture.error === 'budget_exhausted')) setCreativeRemaining(0)
      }
    }
    requestRef.current = null
    setPhase('idle')
    setStatus(controller.signal.aborted ? 'Stopped. Your message is in the card below.' : `Your card is ready below. You can change anything you like.${pictureNote}`)
  }

  async function tryAnotherMessage() {
    if (busy) return
    const controller = new AbortController()
    requestRef.current = controller
    setPhase('writing')
    setStatus('Writing a new message…')
    const suggestion = await writeMessage(controller.signal)
    requestRef.current = null
    setPhase('idle')
    if (!suggestion) return
    onApplyMessage(suggestion.message)
    setStatus('Here’s a new message. The picture and design stay the same.')
  }

  // The click waits briefly for the human check, so the button never sits greyed out without a reason.
  const ready = online && availability === 'available' && !busy
  const statusText = !online
    ? 'You’re offline. Making a card with AI needs the internet, but you can still make a card yourself below.'
    : status ||
      (availability === 'unavailable'
        ? 'Making cards with AI isn’t available right now. You can still make a card yourself below.'
        : availability === 'limit-reached'
          ? 'You’ve made today’s AI cards. Come back tomorrow, or make a card yourself below.'
          : '')
  const assetBase = import.meta.env.BASE_URL

  return (
    <section className="ai-panel ai-simple" aria-labelledby="ai-panel-title" aria-busy={busy}>
      <div className="ai-panel-heading">
        <h2 id="ai-panel-title">Make a card for me</h2>
        <button className="ai-panel-close" type="button" onClick={onClose} aria-label="Close Make a card for me">×</button>
      </div>
      <p className="ai-panel-intro">Choose who it’s for and a look, then press the button. We’ll write the message and add a picture. You can change anything afterwards.</p>

      <form className="ai-form" aria-label="Make a card with AI" onSubmit={(event) => { event.preventDefault(); void makeCard() }}>
        <fieldset className="ai-choices">
          <legend>A {occasion.toLowerCase()} card for…</legend>
          <div className="ai-choice-row">
            {aiRecipients.map((item) => (
              <button key={item.id} type="button" className={`ai-choice ${recipient === item.id ? 'is-selected' : ''}`} aria-pressed={recipient === item.id} onClick={() => setRecipient(item.id)} disabled={busy}>
                {item.label}
              </button>
            ))}
          </div>
          <p className="ai-hint">For a different occasion, choose it in step 01 below.</p>
        </fieldset>

        <fieldset className="ai-choices">
          <legend>Choose a look</legend>
          <div className="ai-look-row">
            {aiLooks.map((item) => (
              <button key={item.id} type="button" className={`ai-look ${look === item.id ? 'is-selected' : ''}`} aria-pressed={look === item.id} onClick={() => setLook(item.id)} disabled={busy}>
                <img src={`${assetBase}artwork/${item.example}`} alt="" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="ai-form-wide">
          <span>Anything to mention? <small>optional</small></span>
          <input value={details} maxLength={200} onChange={(event) => setDetails(event.target.value)} placeholder="For example: turning 80, loves roses" disabled={busy} />
        </label>

        {hasTypedMessage && !hasResult && <p className="ai-replace-note">This will replace the message you’ve already written.</p>}
        <div ref={widgetContainerRef} className="ai-turnstile" />
        {verificationError && online && <p className="ai-replace-note">Something didn’t load. Please refresh the page and try again.</p>}

        <div className="ai-actions">
          {/* Distinct keys matter: Stop finishes its work during the click, and if React
              reused this button as the submit button, the same click would start a new card. */}
          {busy ? (
            <button key="stop" className="secondary-action ai-big-button" type="button" onClick={() => requestRef.current?.abort()}>Stop</button>
          ) : (
            <>
              <button key="make" className="primary-action ai-big-button" type="submit" disabled={!ready}>
                {hasResult ? 'Make a new card' : 'Make my card'}
              </button>
              {hasResult && (
                <button key="another" className="secondary-action ai-big-button" type="button" onClick={() => void tryAnotherMessage()} disabled={!ready}>Try another message</button>
              )}
            </>
          )}
        </div>
        <p className="ai-status" role="status" aria-live="polite">{statusText}</p>
        {remaining !== null && availability !== 'unavailable' && online && (
          <p className="ai-remaining">You can make {remaining} more {remaining === 1 ? 'card' : 'cards'} with AI today.</p>
        )}
        <p className="ai-privacy">
          <span aria-hidden="true">⌁</span> Your choices are sent to Cloudflare’s AI service to write and paint your card. Names aren’t sent, and Little Hello doesn’t keep anything. Pictures appear on the downloaded card; shared links use a Little Hello design.
        </p>
      </form>
    </section>
  )
}
