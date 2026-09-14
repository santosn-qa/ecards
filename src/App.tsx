import { useEffect, useMemo, useRef, useState } from 'react'
import { decodeCardHash, createCardUrl, routeCardHash, type DecodeResult } from './card/codec'
import { CardRenderer } from './components/CardRenderer'
import { CardArtwork } from './components/CardArtwork'
import { downloadCardPng } from './components/downloadCardPng'
import { cardTemplates, occasions, type CardDraft, type Occasion } from './data/templates'
import { getMessageFont, messageFonts, type MessageFontId } from './data/typography'
import { getSampleMessages } from './data/sampleMessages'
import { SUPPORT_CONFIG } from './config/support'
import { readDismissedAt, recordDismissal, shouldShowSupportPrompt } from './support/supportPrompt'
import { SupportPanel } from './components/SupportPanel'
import { SupportFooterLink } from './components/SupportFooterLink'
import { useSentCounter } from './counter/useSentCounter'
import { SentCounter } from './components/SentCounter'
import './App.css'

const emptyDraft: CardDraft = { to: '', message: '', from: '' }

type SiteHeaderProps = {
  navHref?: string
  navLabel?: string
}

function SiteHeader({ navHref = '#/guide', navLabel = 'How to guide' }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <a className="brand" href="#/" aria-label="Little Hello home">
        <span className="brand-mark" aria-hidden="true">✦</span><span>Little Hello</span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href={navHref}>{navLabel}</a>
        <p className="privacy-note"><span aria-hidden="true">⌁</span> <span className="privacy-note-full">Made privately on your device</span><span className="privacy-note-short">Private</span></p>
      </nav>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Made for meaningful moments. Works offline after your first visit.</span>
      <span>
        Created by <a href="https://www.linkedin.com/in/nourileesantos/" target="_blank" rel="noopener noreferrer">Nourilee Santos</a>
        {SUPPORT_CONFIG.enabled && <> · <SupportFooterLink /></>}
      </span>
    </footer>
  )
}

function GuidePage() {
  const assetBase = import.meta.env.BASE_URL

  return (
    <div className="app-shell guide-shell">
      <SiteHeader navHref="#/" navLabel="Back to Little Hello →" />
      <main className="guide-main">
        <section className="guide-hero" aria-labelledby="guide-title">
          <div className="guide-copy">
            <p className="eyebrow">How to guide</p>
            <h1 id="guide-title">Send a Little Hello in minutes.</h1>
            <p className="hero-text">Everything you need to make, send, and open a Little Hello card.</p>
            <a className="primary-action" href="#/">Start Making a Card</a>
          </div>
          <div className="guide-hero-note" aria-label="Little Hello privacy note">
            <span>✦</span>
            <p>No account. No fuss.<br />Make your card, share it with a private link, or download it as an image.</p>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="guide-videos-title">
          <div className="section-heading">
            <div><p className="step-label">01 <span>of 02</span></p><h2 id="guide-videos-title">Follow the flow</h2></div>
          </div>
          <div className="guide-demo-grid">
            <article className="guide-demo">
              <div className="guide-demo-media">
                <img src={`${assetBase}guide/little-hello-mobile-creator-guide.gif`} alt="Animated guide showing a creator choosing an occasion, picking a design, writing a message, and sharing a Little Hello card." />
              </div>
              <div className="guide-demo-copy">
                <p className="guide-demo-kicker">For creators</p>
                <h3>Create and share</h3>
                <p>Pick an occasion, choose a design, write your message, then share the card link or download a PNG.</p>
              </div>
            </article>
            <article className="guide-demo">
              <div className="guide-demo-media">
                <img src={`${assetBase}guide/little-hello-mobile-recipient-guide.gif`} alt="Animated guide showing a recipient opening a Little Hello card link, viewing the card, and seeing download and create-your-own-card actions." />
              </div>
              <div className="guide-demo-copy">
                <p className="guide-demo-kicker">For recipients</p>
                <h3>Open and keep</h3>
                <p>Open the link, read the card, download it if you want a keepsake, or make one to send back.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="guide-section guide-two-column" aria-labelledby="guide-share-title">
          <div>
            <p className="step-label">02 <span>of 02</span></p>
            <h2 id="guide-share-title">Tips before sending</h2>
          </div>
          <div className="guide-notes">
            <div>
              <h3>Preview the link</h3>
              <p>After copying the share link, open it in a new tab if you want one last check before sending.</p>
            </div>
            <div>
              <h3>Save a copy</h3>
              <p>Download Card creates an image you can attach to a message, email, or print later.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function App() {
  const [sharedResult, setSharedResult] = useState<DecodeResult | null | undefined>(() => {
    const route = routeCardHash(window.location.hash)
    if (route.kind === 'none') return null
    if (route.kind === 'legacy') return route.result
    return undefined // compact (v2) link: decode is async, see the effect below
  })
  const sharedDecodeGenerationRef = useRef(0)
  const [hashPath, setHashPath] = useState(() => window.location.hash)
  const [occasion, setOccasion] = useState<Occasion>('Birthday')
  const [selectedTemplateId, setSelectedTemplateId] = useState(cardTemplates[0].id)
  const [draft, setDraft] = useState<CardDraft>(emptyDraft)
  const [notice, setNotice] = useState('')
  const [messageIsTyped, setMessageIsTyped] = useState(false)
  const [confirmingSampleOverwrite, setConfirmingSampleOverwrite] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showSupportPanel, setShowSupportPanel] = useState(false)
  const { count: sentCount, bump: bumpSentCounter } = useSentCounter()
  const hasShownSupportPanelRef = useRef(false)
  const [shareUrl, setShareUrl] = useState('')
  const shareUrlGenerationRef = useRef(0)
  const fontOptionsRef = useRef<HTMLDivElement>(null)

  function scrollFontOptions(direction: -1 | 1) {
    fontOptionsRef.current?.scrollBy({ left: direction * 160, behavior: 'smooth' })
  }
  const visibleTemplates = useMemo(
    () => cardTemplates.filter((template) => template.occasion === occasion),
    [occasion],
  )
  const selectedTemplate =
    cardTemplates.find((template) => template.id === selectedTemplateId) ?? visibleTemplates[0]

  function applySharedHash(hash: string) {
    // Bump the generation on every hash transition, regardless of route kind, so
    // any decode still in flight from a previous hash is immediately invalidated
    // even when the new hash turns out to be legacy/none rather than compact.
    const generation = ++sharedDecodeGenerationRef.current
    const route = routeCardHash(hash)
    if (route.kind === 'none') return setSharedResult(null)
    if (route.kind === 'legacy') return setSharedResult(route.result)
    setSharedResult(undefined)
    decodeCardHash(hash).then((result) => {
      if (sharedDecodeGenerationRef.current === generation) setSharedResult(result)
    })
  }

  useEffect(() => {
    // The sharedResult state initializer above already computed the synchronous
    // value for the initial hash (none/legacy). Only a compact initial hash still
    // needs work here, to kick off its async decode.
    if (routeCardHash(window.location.hash).kind === 'compact') {
      applySharedHash(window.location.hash)
    }
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      setHashPath(window.location.hash)
      applySharedHash(window.location.hash)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const generation = ++shareUrlGenerationRef.current
    createCardUrl(draft, selectedTemplate.id).then((url) => {
      if (shareUrlGenerationRef.current === generation) setShareUrl(url)
    })
  }, [draft, selectedTemplate.id])

  if (hashPath === '#/guide') {
    return <GuidePage />
  }

  if (sharedResult === undefined) {
    return (
      <div className="app-shell shared-shell">
        <SiteHeader />
        <main className="shared-main" aria-busy="true">
          <p className="eyebrow" role="status" aria-live="polite">Opening your card…</p>
        </main>
      </div>
    )
  }

  if (sharedResult?.ok) {
    const template = cardTemplates.find(({ id }) => id === sharedResult.card.template) ?? cardTemplates[0]
    return (
      <div className="app-shell shared-shell">
        <SiteHeader />
        <main className="shared-main">
          <p className="eyebrow">A little hello for you</p>
          <h1 className="shared-title">{sharedResult.card.to ? `${sharedResult.card.to}, this is for you.` : 'Someone made this for you.'}</h1>
          <div className="shared-card-wrap">
            <CardRenderer card={sharedResult.card} template={template} />
          </div>
          <div className="action-row">
            <button className="primary-action" type="button" onClick={() => downloadCardPng(sharedResult.card, template)}>Download Card</button>
            <a className="secondary-action" href="#/">Create Your Own Card</a>
          </div>
          <p className="preview-footnote">This card was created privately in a browser.<br />No account or storage needed.</p>
        </main>
        <SiteFooter />
      </div>
    )
  }

  function selectTemplate(templateId: string) {
    const nextTemplate = cardTemplates.find((template) => template.id === templateId)
    if (!nextTemplate) return
    setSelectedTemplateId(templateId)
    setDraft((current) => ({ ...current, messageFont: nextTemplate.typography.defaultMessageFont }))
  }

  if (sharedResult && !sharedResult.ok) {
    return (
      <div className="app-shell shared-shell">
        <SiteHeader />
        <main className="shared-main error-state">
          <p className="eyebrow">This card link needs a little help</p>
          <h1 className="shared-title">We couldn’t open this card.</h1>
          <p>It may be incomplete, outdated, or missing its design. You can still make a new card right here.</p>
          <a className="primary-action" href="#/">Create Your Own Card</a>
        </main>
        <SiteFooter />
      </div>
    )
  }

  function handleOccasionChange(nextOccasion: Occasion) {
    setOccasion(nextOccasion)
    const firstTemplate = cardTemplates.find((template) => template.occasion === nextOccasion)
    if (firstTemplate) {
      setSelectedTemplateId(firstTemplate.id)
      setDraft((current) => ({ ...current, message: '', messageFont: firstTemplate.typography.defaultMessageFont }))
      setNotice('')
      setMessageIsTyped(false)
      setConfirmingSampleOverwrite(false)
    }
  }

  function updateDraft(field: keyof CardDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setNotice('')
  }

  function handleMessageChange(value: string) {
    updateDraft('message', value)
    setMessageIsTyped(value.trim().length > 0)
    setConfirmingSampleOverwrite(false)
  }

  function clearMessage() {
    updateDraft('message', '')
    setMessageIsTyped(false)
    setConfirmingSampleOverwrite(false)
  }

  function confirmOrWarnEmptyMessage(actionLabel: string) {
    if (draft.message.trim()) return true
    return window.confirm(`Your message is empty — ${actionLabel} anyway?`)
  }

  function applySampleMessage(text: string) {
    const hasTypedDraft = messageIsTyped && draft.message.trim().length > 0
    if (hasTypedDraft && !confirmingSampleOverwrite) {
      setConfirmingSampleOverwrite(true)
      setNotice('This will replace your message — click the sample again to confirm.')
      return
    }
    updateDraft('message', text)
    setMessageIsTyped(false)
    setConfirmingSampleOverwrite(false)
  }

  function maybeShowSupportPanel() {
    if (hasShownSupportPanelRef.current) return
    if (!shouldShowSupportPrompt(Date.now(), readDismissedAt(), SUPPORT_CONFIG.enabled)) return
    hasShownSupportPanelRef.current = true
    setShowSupportPanel(true)
  }

  function dismissSupportPanel() {
    recordDismissal(Date.now())
    setShowSupportPanel(false)
  }

  async function copyLink(options?: { skipEmptyGuard?: boolean }) {
    if (!options?.skipEmptyGuard && !confirmOrWarnEmptyMessage('Copy Link')) return
    const url = await createCardUrl(draft, selectedTemplate.id)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(url)
      setNotice('Link copied!')
      maybeShowSupportPanel()
      bumpSentCounter()
    } catch {
      setNotice('Copy failed. You can select the link below.')
    }
  }

  async function shareCard() {
    if (!confirmOrWarnEmptyMessage('Share Card')) return
    const url = await createCardUrl(draft, selectedTemplate.id)
    if ('share' in navigator) {
      try {
        await navigator.share({ title: 'A Little Hello card', text: 'Someone made a card for you.', url })
        setNotice('Ready to share!')
        maybeShowSupportPanel()
        bumpSentCounter()
      } catch {
        setNotice('Sharing was cancelled.')
      }
    } else {
      await copyLink({ skipEmptyGuard: true })
    }
  }

  async function exportCard() {
    if (!confirmOrWarnEmptyMessage('Download Card')) return
    setIsExporting(true)
    try {
      await downloadCardPng(draft, selectedTemplate)
      setNotice('Card downloaded!')
      maybeShowSupportPanel()
      bumpSentCounter()
    } catch {
      setNotice('The card could not be downloaded. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main>
        <section className="hero-section" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="eyebrow">A small gesture, made special</p>
            <h1 id="welcome-title">Make someone’s day.</h1>
            <p className="hero-text">Choose a beautiful design, add your words, and share a little hello. No account needed.</p>
            <SentCounter count={sentCount} />
          </div>
          <div className="hero-sparkles" aria-hidden="true"><span>✦</span><span>✧</span><span>·</span></div>
        </section>
        <section className="step-section" aria-labelledby="occasion-title">
          <div className="section-heading">
            <div><p className="step-label">01 <span>of 03</span></p><h2 id="occasion-title">What’s the occasion?</h2></div>
            <span className="section-hint">Pick one to get started</span>
          </div>
          <div className="occasion-list" role="list" aria-label="Card occasions">
            {occasions.map((item) => (
              <button className={`occasion-chip ${occasion === item ? 'is-selected' : ''}`} key={item} type="button" onClick={() => handleOccasionChange(item)} aria-pressed={occasion === item}>{item}</button>
            ))}
          </div>
        </section>
        <section className="workspace" aria-label="Card creator">
          <div className="design-column">
            <div className="section-heading compact">
              <div><p className="step-label">02 <span>of 03</span></p><h2>Choose a design</h2></div>
              <span className="section-hint">{visibleTemplates.length} designs</span>
            </div>
            <div className="template-grid">
              {visibleTemplates.map((template) => (
                <button className={`template-button ${selectedTemplate.id === template.id ? 'is-selected' : ''}`} key={template.id} type="button" onClick={() => selectTemplate(template.id)} aria-label={`Choose ${template.name} design`} aria-pressed={selectedTemplate.id === template.id}>
                  <div className={`template-art card-style-${template.style}`} style={{ backgroundColor: template.artwork.backgroundColor }} aria-hidden="true">
                    <CardArtwork template={template} />
                  </div>
                  <span className="template-name">{template.name}</span>
                </button>
              ))}
            </div>
            <div className="editor-panel">
              <div className="section-heading compact"><div><p className="step-label">03 <span>of 03</span></p><h2>Write your message</h2></div></div>
              <div className="form-fields">
                <label>
                  <span className="field-label-row">
                    <span>To <small>optional</small></span>
                    <small className="field-char-counter" aria-hidden="true">{draft.to.length}/60</small>
                  </span>
                  <input value={draft.to} maxLength={60} onChange={(event) => updateDraft('to', event.target.value)} placeholder="Who is this for?" />
                </label>
                <div className="message-field">
                  <div className="message-field-heading">
                    <label htmlFor="card-message">Your message</label>
                    <span className="message-field-meta">
                      <small>{draft.message.length}/500</small>
                      {draft.message && (
                        <button className="clear-message-button" type="button" onClick={clearMessage}>
                          Clear
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="sample-chips-hint">Need a starting point? Try one, or just write your own.</p>
                  <div className="sample-chips" role="list" aria-label="Sample messages">
                    {getSampleMessages(occasion).map((sample) => (
                      <button className="sample-chip" key={sample.tone} type="button" onClick={() => applySampleMessage(sample.text)}>
                        {sample.tone}
                      </button>
                    ))}
                  </div>
                  <textarea id="card-message" aria-label={`Your message ${draft.message.length}/500`} value={draft.message} maxLength={500} onChange={(event) => handleMessageChange(event.target.value)} placeholder="Write something from the heart..." rows={5} />
                </div>
                <label>
                  <span className="field-label-row">
                    <span>From <small>optional</small></span>
                    <small className="field-char-counter" aria-hidden="true">{draft.from.length}/60</small>
                  </span>
                  <input value={draft.from} maxLength={60} onChange={(event) => updateDraft('from', event.target.value)} placeholder="Your name" />
                </label>
              </div>
              <div className="font-picker" aria-labelledby="message-font-title">
                <div className="font-picker-heading">
                  <span id="message-font-title">Personality for your message</span>
                  <small>Recommended: {getMessageFont(selectedTemplate.typography.defaultMessageFont).name}</small>
                </div>
                <div className="font-options-row">
                  <button type="button" className="font-scroll-button" aria-label="Show previous font styles" onClick={() => scrollFontOptions(-1)}>‹</button>
                  <div className="font-options" role="listbox" aria-label="Message font" ref={fontOptionsRef}>
                    {messageFonts.map((font) => (
                      <button
                        className={`font-option ${(draft.messageFont || selectedTemplate.typography.defaultMessageFont) === font.id ? 'is-selected' : ''}`}
                        key={font.id}
                        type="button"
                        role="option"
                        aria-selected={(draft.messageFont || selectedTemplate.typography.defaultMessageFont) === font.id}
                        onClick={() => setDraft((current) => ({ ...current, messageFont: font.id as MessageFontId }))}
                      >
                        <span className="font-option-name" style={{ fontFamily: font.family }}>{font.name}</span>
                        <span className="font-option-sample" style={{ fontFamily: font.family }}>{font.sample}</span>
                        <span className="font-option-category">{font.category}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="font-scroll-button" aria-label="Show more font styles" onClick={() => scrollFontOptions(1)}>›</button>
                </div>
              </div>
              <div className="share-actions">
                <button className="primary-action" type="button" onClick={shareCard}>Share Card</button>
                <button className="secondary-action" type="button" onClick={() => copyLink()}>Copy Link</button>
                <button className="secondary-action" type="button" onClick={exportCard} disabled={isExporting}>{isExporting ? 'Preparing…' : 'Download Card'}</button>
              </div>
              <label className="share-link-field">Share link
                <input readOnly aria-label="Share link" value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
              </label>
              <p className="action-status" role="status" aria-live="polite">{notice}</p>
              {showSupportPanel && <SupportPanel onDismiss={dismissSupportPanel} />}
            </div>
          </div>
          <aside className="preview-column" aria-label="Live card preview">
            <div className="preview-label"><span className="live-dot" /> Live preview</div>
            <CardRenderer card={draft} template={selectedTemplate} />
            <p className="preview-footnote">Your card is created on your device.<br />We don’t need to store it.</p>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
