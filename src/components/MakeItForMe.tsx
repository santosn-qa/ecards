import { useEffect, useRef, useState } from 'react'
import {
  aiLooks,
  describeAiError,
  fetchAiStatus,
  generateAiIllustration,
  generateAiMessage,
  toneForRecipient,
  type AiCardSuggestion,
  type AiErrorCode,
  type AiRecipient,
} from '../ai/aiClient'
import { loadTurnstile, type TurnstileApi } from '../ai/turnstile'
import type { Occasion } from '../data/templates'

export type AiApplied = AiCardSuggestion & { occasion: Occasion }
export type AiIllustrationApplied = { blob: Blob; occasion: Occasion }

type MakeItForMeProps = {
  apiUrl: string
  turnstileSiteKey: string
  /** The design set for the chosen occasion: what the Worker designs for. */
  occasion: Occasion
  /** The occasion the person picked, in its own words, e.g. "Get well soon". */
  occasionLabel: string
  recipient: AiRecipient
  /** True when the editor already holds the user's own words, so we can warn before replacing them. */
  hasTypedMessage: boolean
  /** False when this who + what already has a card (e.g. after Go Back), so nothing new is made by itself. */
  autoStart?: boolean
  onApply: (result: AiApplied) => void
  onApplyMessage: (message: string) => void
  /** Called with a validated JPEG; the app shows it from a local blob: URL. */
  onApplyIllustration: (result: AiIllustrationApplied) => void
}

type Availability = 'checking' | 'available' | 'unavailable' | 'limit-reached'
type Phase = 'idle' | 'writing' | 'painting'

const TOKEN_WAIT_MS = 15_000

/**
 * "Make it for me": no questions. It uses the occasion from step 1,
 * writes the message, then adds a matching picture when one is available
 * today; otherwise the card keeps a Little Hello design. It starts by itself
 * once ready, unless that would replace words the person typed.
 */
export function MakeItForMe({ apiUrl, turnstileSiteKey, occasion, occasionLabel, recipient, hasTypedMessage, autoStart = true, onApply, onApplyMessage, onApplyIllustration }: MakeItForMeProps) {
  // Each card gets one of the three house looks, so cards vary while staying on theme.
  const [look] = useState(() => aiLooks[Math.floor(Math.random() * aiLooks.length)].id)
  const [confirmedReplace, setConfirmedReplace] = useState(!hasTypedMessage)
  const startedRef = useRef(!autoStart)
  const [availability, setAvailability] = useState<Availability>('checking')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [creativeRemaining, setCreativeRemaining] = useState(0)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [verificationError, setVerificationError] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState(autoStart ? '' : 'Your card is ready below. You can change anything you like.')
  const [hasResult, setHasResult] = useState(!autoStart)
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

  // Start by itself as soon as AI is available (and the person agreed to replace their words, if any).
  useEffect(() => {
    if (availability !== 'available' || !confirmedReplace || startedRef.current) return
    startedRef.current = true
    void makeCard()
    // makeCard reads the latest props when it runs; this should only fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, confirmedReplace])

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
      { turnstileToken: token, occasion, recipient, tone: toneForRecipient(recipient, occasion), style: look, personalMessage: '', extraInstructions: `Occasion: ${occasionLabel}.`.slice(0, 200) },
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

  return (
    <div className="make-for-me" aria-busy={busy}>
      <p className="make-for-me-summary">
        <span aria-hidden="true">✦</span> A <strong>{occasionLabel.toLowerCase()}</strong> card, with a message and a picture made for you. Add who it’s for and your name below.
      </p>
      {!confirmedReplace && (
        <div className="message-card-confirm" role="group" aria-label="Replace your message?">
          <p>This will replace the message you wrote. Make a new one for you?</p>
          <button type="button" className="primary-action ai-big-button" onClick={() => setConfirmedReplace(true)}>Yes, make it for me</button>
        </div>
      )}
      <div ref={widgetContainerRef} className="ai-turnstile" />
      {verificationError && online && <p className="ai-replace-note">Something didn’t load. Please refresh the page and try again.</p>}
      <p className="ai-status" role="status" aria-live="polite">{statusText || (availability === 'checking' && online ? 'Getting ready…' : '')}</p>
      <div className="ai-actions">
        {/* Distinct keys matter: Stop finishes its work during the click, and if React
            reused this button for another one, the same click could start a new card. */}
        {busy ? (
          <button key="stop" className="secondary-action ai-big-button" type="button" onClick={() => requestRef.current?.abort()}>Stop</button>
        ) : hasResult ? (
          <>
            <button key="another" className="secondary-action ai-big-button" type="button" onClick={() => void tryAnotherMessage()} disabled={!ready}>Try another message</button>
            <button key="new" className="secondary-action ai-big-button" type="button" onClick={() => void makeCard()} disabled={!ready}>Make a new card</button>
          </>
        ) : availability === 'available' && confirmedReplace && !status.startsWith('Writing') ? (
          <button key="retry" className="primary-action ai-big-button" type="button" onClick={() => void makeCard()} disabled={!ready}>Try again</button>
        ) : null}
      </div>
      {remaining !== null && availability !== 'unavailable' && online && (
        <p className="ai-remaining">You can make {remaining} more {remaining === 1 ? 'card' : 'cards'} with AI today.</p>
      )}
      <p className="ai-privacy">
        <span aria-hidden="true">⌁</span> Your choices are sent to Cloudflare’s AI service to write your card. Names aren’t sent, and Little Hello doesn’t keep anything. Pictures appear on the downloaded card; shared links use a Little Hello design.
      </p>
    </div>
  )
}
