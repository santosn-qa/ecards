import { useEffect, useMemo, useRef, useState } from 'react'
import { decodeCardHash, createCardUrl, routeCardHash, type DecodeResult } from './card/codec'
import { CardRenderer } from './components/CardRenderer'
import { CardArtwork } from './components/CardArtwork'
import { downloadCardPng } from './components/downloadCardPng'
import { cardTemplates, type CardDraft, type Occasion } from './data/templates'
import { getMessageFont, messageFonts, type MessageFontId } from './data/typography'
import { SUPPORT_CONFIG } from './config/support'
import { readDismissedAt, recordDismissal, shouldShowSupportPrompt } from './support/supportPrompt'
import { SupportPanel } from './components/SupportPanel'
import { SupportFooterLink } from './components/SupportFooterLink'
import { useSentCounter } from './counter/useSentCounter'
import { SentCounter } from './components/SentCounter'
import { AI_CONFIG } from './config/ai'
import { MakeItForMe, type AiApplied, type AiIllustrationApplied } from './components/MakeItForMe'
import { ChoiceStep } from './components/ChoiceStep'
import { MessageChooser } from './components/MessageChooser'
import { getOccasion, occasionGroups, occasionLibrary, popularOccasions } from './data/occasionLibrary'
import { searchOccasions } from './messages/findMessages'
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
      <span>Made for meaningful moments.</span>
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
  // Two ways to make a card, shown one step at a time:
  //   Make it for me:  1 What → 2 Your card (AI writes it and adds a picture)
  //   Make it myself:  1 What → 2 Design → 3 Your message (ready-made or own words)
  // Who it's for is simply the card's To field.
  // Without AI (e.g. the GitHub Pages copy) the app goes straight to "myself".
  const [mode, setMode] = useState<'generate' | 'customize' | null>(() => (AI_CONFIG.enabled ? null : 'customize'))
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [occasionId, setOccasionId] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  /** Who + what of the last AI card, so going Back and forward doesn't quietly make (and use up) another. */
  const [lastAiKey, setLastAiKey] = useState<string | null>(null)
  const wizardRef = useRef<HTMLDivElement>(null)
  const occasionEntry = getOccasion(occasionId ?? 'birthday')!
  const occasion: Occasion = occasionEntry.designs
  const [selectedTemplateId, setSelectedTemplateId] = useState(cardTemplates[0].id)
  const [draft, setDraft] = useState<CardDraft>(emptyDraft)
  const [notice, setNotice] = useState('')
  const [messageIsTyped, setMessageIsTyped] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showSupportPanel, setShowSupportPanel] = useState(false)
  const { count: sentCount, bump: bumpSentCounter } = useSentCounter()
  const hasShownSupportPanelRef = useRef(false)
  const [shareUrl, setShareUrl] = useState('')
  const shareUrlGenerationRef = useRef(0)
  const fontOptionsRef = useRef<HTMLDivElement>(null)
  const editorPanelRef = useRef<HTMLDivElement>(null)
  const [aiAssisted, setAiAssisted] = useState(false)
  // An AI illustration lives only in this tab, as a local blob: URL. It is never
  // uploaded or put in share links, which keep using the chosen template.
  const [aiArt, setAiArt] = useState<{ url: string; occasion: Occasion } | null>(null)
  const [useAiArt, setUseAiArt] = useState(false)
  const aiArtUrlRef = useRef<string | null>(null)
  useEffect(() => () => {
    if (aiArtUrlRef.current) URL.revokeObjectURL(aiArtUrlRef.current)
  }, [])

  function scrollFontOptions(direction: -1 | 1) {
    fontOptionsRef.current?.scrollBy({ left: direction * 160, behavior: 'smooth' })
  }
  const visibleTemplates = useMemo(
    () => cardTemplates.filter((template) => template.occasion === occasion),
    [occasion],
  )
  const selectedTemplate =
    cardTemplates.find((template) => template.id === selectedTemplateId) ?? visibleTemplates[0]
  const showingAiArt = useAiArt && aiArt !== null

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
      // A new page (the guide, a shared card) should open at its top, not wherever the editor was scrolled to.
      window.scrollTo(0, 0)
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
    // Picking a design means the user wants that design's artwork.
    setUseAiArt(false)
  }

  function clearAiArt() {
    if (aiArtUrlRef.current) URL.revokeObjectURL(aiArtUrlRef.current)
    aiArtUrlRef.current = null
    setAiArt(null)
    setUseAiArt(false)
  }

  function applyAiIllustration(result: AiIllustrationApplied) {
    if (aiArtUrlRef.current) URL.revokeObjectURL(aiArtUrlRef.current)
    const url = URL.createObjectURL(result.blob)
    aiArtUrlRef.current = url
    setAiArt({ url, occasion: result.occasion })
    setUseAiArt(true)
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

  function handleOccasionChange(nextOccasionId: string) {
    const next = getOccasion(nextOccasionId)
    if (!next) return
    setOccasionId(nextOccasionId)
    setNotice('')
    if (next.designs !== occasion) {
      // Show designs that fit the new occasion. The message is kept: never
      // throw away words without asking.
      const firstTemplate = cardTemplates.find((template) => template.occasion === next.designs)
      if (firstTemplate) {
        setSelectedTemplateId(firstTemplate.id)
        setDraft((current) => ({ ...current, messageFont: firstTemplate.typography.defaultMessageFont }))
      }
      clearAiArt()
    }
  }

  const aiKey = occasionId ?? ''
  const totalSteps = mode === 'generate' ? 2 : 3

  function goTo(nextStep: 1 | 2 | 3) {
    setStep(nextStep)
    requestAnimationFrame(() => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function chooseMode(next: 'generate' | 'customize') {
    setMode(next)
    goTo(1)
  }

  function goBack() {
    if (step > 1) return goTo((step === 3 && mode === 'customize' ? 2 : 1) as 1 | 2)
    if (AI_CONFIG.enabled) setMode(null)
  }

  /** From the finished AI card to the "myself" message step, keeping everything. */
  function changeSomething() {
    setMode('customize')
    goTo(3)
  }

  function applyLibraryMessage(text: string) {
    updateDraft('message', text)
    // Treated like the person's own words from here on: editable, and protected from silent replacement.
    setMessageIsTyped(true)
    setAiAssisted(false)
    setShowLibrary(false)
  }

  function startOver() {
    const hasWork = draft.message.trim() || draft.to.trim() || draft.from.trim()
    if (hasWork && !window.confirm('Start over? This clears your card so you can begin again.')) return
    setOccasionId(null)
    setShowLibrary(false)
    setLastAiKey(null)
    setSelectedTemplateId(cardTemplates[0].id)
    setDraft(emptyDraft)
    setMessageIsTyped(false)
    setAiAssisted(false)
    setNotice('')
    clearAiArt()
    setMode(AI_CONFIG.enabled ? null : 'customize')
    goTo(1)
  }

  // An AI suggestion lands in the normal editor, exactly as if the user had
  // picked the occasion, design, font and words themselves, so everything
  // stays editable and shares/downloads through the existing renderer.
  function applyAiCard(result: AiApplied) {
    if (aiArt && aiArt.occasion !== result.occasion) clearAiArt()
    setSelectedTemplateId(result.templateId)
    setDraft((current) => ({ ...current, message: result.message, messageFont: result.messageFont }))
    // Protect the suggestion from being silently replaced by a sample chip.
    setMessageIsTyped(true)
    setNotice('')
    setAiAssisted(result.source === 'ai')
    setLastAiKey(aiKey)
  }

  function applyAiMessage(message: string) {
    updateDraft('message', message)
    setMessageIsTyped(true)
    setAiAssisted(true)
  }

  function updateDraft(field: keyof CardDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setNotice('')
  }

  function handleMessageChange(value: string) {
    updateDraft('message', value)
    setMessageIsTyped(value.trim().length > 0)
  }

  function clearMessage() {
    updateDraft('message', '')
    setMessageIsTyped(false)
    setAiAssisted(false)
  }

  function confirmOrWarnEmptyMessage(actionLabel: string) {
    if (draft.message.trim()) return true
    return window.confirm(`Your message is empty — ${actionLabel} anyway?`)
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
      setNotice(showingAiArt ? 'Link copied! It shows the Little Hello design. Download the card to keep the AI illustration.' : 'Link copied!')
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
        setNotice(showingAiArt ? 'Ready to share! The link shows the Little Hello design.' : 'Ready to share!')
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
      await downloadCardPng(draft, selectedTemplate, { artworkUrl: showingAiArt ? aiArt?.url : undefined })
      setNotice('Card downloaded!')
      maybeShowSupportPanel()
      bumpSentCounter()
    } catch {
      setNotice('The card could not be downloaded. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const occasionChoices = {
    popular: popularOccasions,
    groups: occasionGroups.map((group) => ({ label: group.label, items: occasionLibrary.filter((item) => item.group === group.id && !item.popular) })).filter((group) => group.items.length > 0),
    search: searchOccasions,
  }

  const namesFields = (
    <>
      <label>
        <span className="field-label-row">
          <span>To <small>optional</small></span>
          <small className="field-char-counter" aria-hidden="true">{draft.to.length}/60</small>
        </span>
        <input value={draft.to} maxLength={60} onChange={(event) => updateDraft('to', event.target.value)} placeholder="Who is this for?" />
      </label>
      <label>
        <span className="field-label-row">
          <span>From <small>optional</small></span>
          <small className="field-char-counter" aria-hidden="true">{draft.from.length}/60</small>
        </span>
        <input value={draft.from} maxLength={60} onChange={(event) => updateDraft('from', event.target.value)} placeholder="Your name" />
      </label>
    </>
  )

  const shareBlock = (
    <>
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
    </>
  )

  const previewColumn = (
    <aside className="preview-column" aria-label="Live card preview">
      <div className="preview-label"><span className="live-dot" /> Live preview</div>
      <CardRenderer card={draft} template={selectedTemplate} artworkUrl={showingAiArt ? aiArt?.url : undefined} />
      {aiArt && (
        <p className="ai-art-note">
          {showingAiArt ? (
            <>
              <span><span aria-hidden="true">✦</span> AI-generated illustration. Share links show the Little Hello design.</span>
              <button className="ai-art-toggle" type="button" onClick={() => setUseAiArt(false)}>Use the Little Hello design</button>
            </>
          ) : (
            <button className="ai-art-toggle" type="button" onClick={() => setUseAiArt(true)}>Use my AI illustration</button>
          )}
        </p>
      )}
      <p className="preview-footnote">Your card is created on your device.<br />We don’t need to store it.</p>
    </aside>
  )

  const modeLabel = mode === 'generate' ? 'Make it for me' : 'Make it myself'

  return (
    <div className="app-shell">
      <SiteHeader />
      <main>
        <section className="hero-section" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="eyebrow">A small gesture, made special</p>
            <h1 id="welcome-title">Make someone’s day.</h1>
            <p className="hero-text">Send a beautiful card in three easy steps. No account needed.</p>
            <SentCounter count={sentCount} />
          </div>
          <div className="hero-sparkles" aria-hidden="true"><span>✦</span><span>✧</span><span>·</span></div>
        </section>

        <div className="wizard" ref={wizardRef}>
          {mode === null ? (
            <section className="step-section mode-choice" aria-labelledby="mode-title">
              <h2 id="mode-title">How would you like to make your card?</h2>
              <div className="mode-options" role="group" aria-labelledby="mode-title">
                <button type="button" className="mode-option" onClick={() => chooseMode('generate')}>
                  <span className="mode-option-title"><span aria-hidden="true">✦ </span>Make it for me</span>
                  <span className="mode-option-text">Just choose the occasion. We’ll write the message and add a picture.</span>
                </button>
                <button type="button" className="mode-option" onClick={() => chooseMode('customize')}>
                  <span className="mode-option-title">Make it myself</span>
                  <span className="mode-option-text">Choose the occasion and a design, then write your own words or pick a ready-made message.</span>
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className="wizard-bar">
                {(step > 1 || AI_CONFIG.enabled) && <button type="button" className="secondary-action wizard-back" onClick={goBack}>← Go Back</button>}
                <p className="wizard-progress">{AI_CONFIG.enabled ? `${modeLabel} · ` : ''}Step {step} of {totalSteps}</p>
                <button type="button" className="secondary-action wizard-start-over" onClick={startOver}>Start Over</button>
              </div>

              {step === 1 && (
                <ChoiceStep
                  id="occasion-step"
                  title="What would you like to say?"
                  {...occasionChoices}
                  selectedId={occasionId}
                  selectedLabel={occasionId ? occasionEntry.label : undefined}
                  onSelect={(id) => { handleOccasionChange(id); goTo(2) }}
                  searchLabel="Search for an occasion"
                  searchExample="wedding"
                />
              )}

              {mode === 'customize' && step === 2 && (
                <section className="workspace" aria-label="Choose a design">
                  <div className="design-column">
                    <div className="section-heading compact">
                      <div><h2>Choose a design</h2></div>
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
                    <button type="button" className="primary-action wizard-next" onClick={() => goTo(3)}>Next: Your message →</button>
                  </div>
                  {previewColumn}
                </section>
              )}

              {mode === 'generate' && step >= 2 && (
                <section className="ai-card-step" aria-label="Your card">
                  <div className="ai-card-column">
                    <div className="section-heading compact"><div><h2>Your card</h2></div></div>
                    {AI_CONFIG.apiUrl && AI_CONFIG.turnstileSiteKey && (
                      <MakeItForMe
                        apiUrl={AI_CONFIG.apiUrl}
                        turnstileSiteKey={AI_CONFIG.turnstileSiteKey}
                        occasion={occasion}
                        occasionLabel={occasionEntry.label}
                        recipient="someone"
                        hasTypedMessage={messageIsTyped && draft.message.trim().length > 0 && lastAiKey === null}
                        autoStart={lastAiKey !== aiKey}
                        onApply={applyAiCard}
                        onApplyMessage={applyAiMessage}
                        onApplyIllustration={applyAiIllustration}
                      />
                    )}
                    {/* One column on every screen: the finished card comes right after the AI status, before names and sharing. */}
                    {previewColumn}
                    <div className="editor-panel" ref={editorPanelRef}>
                      <div className="form-fields">{namesFields}</div>
                      <button type="button" className="secondary-action change-something" onClick={changeSomething}>Change something</button>
                      {shareBlock}
                    </div>
                  </div>
                </section>
              )}

              {mode === 'customize' && step === 3 && (
                <section className="workspace" aria-label="Card creator">
                  <div className="design-column">
                    <div className="editor-panel" ref={editorPanelRef}>
                      <div className="section-heading compact"><div><h2>Your message</h2></div></div>
                      <div className="form-fields">
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
                          <button type="button" className="change-message-button" aria-expanded={showLibrary} onClick={() => setShowLibrary((open) => !open)}>
                            {showLibrary ? 'Hide ready-made messages' : draft.message ? 'Change Message' : 'Choose a ready-made message'}
                          </button>
                          {showLibrary && (
                            <MessageChooser
                              key={occasionId ?? 'all'}
                              recipientIds={[]}
                              occasionId={occasionId}
                              hasTypedMessage={messageIsTyped && draft.message.trim().length > 0}
                              onUse={applyLibraryMessage}
                            />
                          )}
                          {aiAssisted && <p className="ai-assisted-note"><span aria-hidden="true">✦</span> Written with AI help. Edit anything you like.</p>}
                          <textarea id="card-message" aria-label={`Your message ${draft.message.length}/500`} value={draft.message} maxLength={500} onChange={(event) => handleMessageChange(event.target.value)} placeholder="Write something from the heart..." rows={5} />
                        </div>
                        {namesFields}
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
                      {shareBlock}
                    </div>
                  </div>
                  {previewColumn}
                </section>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
