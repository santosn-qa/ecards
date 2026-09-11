import { useEffect, useMemo, useState } from 'react'
import { decodeCardHash, createCardUrl, encodeCard, type DecodeResult } from './card/codec'
import { CardRenderer } from './components/CardRenderer'
import { CardArtwork } from './components/CardArtwork'
import { downloadCardPng } from './components/downloadCardPng'
import { cardTemplates, occasions, type CardDraft, type Occasion } from './data/templates'
import { getMessageFont, messageFonts, type MessageFontId } from './data/typography'
import './App.css'

const emptyDraft: CardDraft = { to: '', message: '', from: '' }

function App() {
  const [sharedResult, setSharedResult] = useState<DecodeResult | null | undefined>(() => decodeCardHash(window.location.hash))
  const [occasion, setOccasion] = useState<Occasion>('Birthday')
  const [selectedTemplateId, setSelectedTemplateId] = useState(cardTemplates[0].id)
  const [draft, setDraft] = useState<CardDraft>(emptyDraft)
  const [notice, setNotice] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const visibleTemplates = useMemo(
    () => cardTemplates.filter((template) => template.occasion === occasion),
    [occasion],
  )
  const selectedTemplate =
    cardTemplates.find((template) => template.id === selectedTemplateId) ?? visibleTemplates[0]

  useEffect(() => {
    const handleHashChange = () => setSharedResult(decodeCardHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (sharedResult?.ok) {
    const template = cardTemplates.find(({ id }) => id === sharedResult.card.template) ?? cardTemplates[0]
    return (
      <div className="app-shell shared-shell">
        <header className="site-header">
          <a className="brand" href="#/" aria-label="Little Hello home">
            <span className="brand-mark" aria-hidden="true">✦</span><span>Little Hello</span>
          </a>
          <p className="privacy-note"><span aria-hidden="true">⌁</span> Made privately on your device</p>
        </header>
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
        <footer className="site-footer">
          <span>Made for meaningful moments.</span>
          <span>Created by <a href="https://www.linkedin.com/in/nourileesantos/" target="_blank" rel="noopener noreferrer">Nourilee Santos</a></span>
        </footer>
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
        <header className="site-header">
          <a className="brand" href="#/" aria-label="Little Hello home">
            <span className="brand-mark" aria-hidden="true">✦</span><span>Little Hello</span>
          </a>
        </header>
        <main className="shared-main error-state">
          <p className="eyebrow">This card link needs a little help</p>
          <h1 className="shared-title">We couldn’t open this card.</h1>
          <p>It may be incomplete, outdated, or missing its design. You can still make a new card right here.</p>
          <a className="primary-action" href="#/">Create Your Own Card</a>
        </main>
        <footer className="site-footer">
          <span>Made for meaningful moments.</span>
          <span>Created by <a href="https://www.linkedin.com/in/nourileesantos/" target="_blank" rel="noopener noreferrer">Nourilee Santos</a></span>
        </footer>
      </div>
    )
  }

  function handleOccasionChange(nextOccasion: Occasion) {
    setOccasion(nextOccasion)
    const firstTemplate = cardTemplates.find((template) => template.occasion === nextOccasion)
    if (firstTemplate) {
      setSelectedTemplateId(firstTemplate.id)
      setDraft((current) => ({ ...current, messageFont: firstTemplate.typography.defaultMessageFont }))
    }
  }

  function updateDraft(field: keyof CardDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setNotice('')
  }

  async function copyLink() {
    const url = createCardUrl(draft, selectedTemplate.id)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(url)
      setNotice('Link copied!')
    } catch {
      setNotice('Copy failed. You can select the link below.')
    }
  }

  async function shareCard() {
    const url = createCardUrl(draft, selectedTemplate.id)
    if ('share' in navigator) {
      try {
        await navigator.share({ title: 'A Little Hello card', text: 'Someone made a card for you.', url })
        setNotice('Ready to share!')
      } catch {
        setNotice('Sharing was cancelled.')
      }
    } else {
      await copyLink()
    }
  }

  async function exportCard() {
    setIsExporting(true)
    try {
      await downloadCardPng(draft, selectedTemplate)
      setNotice('Card downloaded!')
    } catch {
      setNotice('The card could not be downloaded. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const currentUrl = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}#/card/${encodeCard(draft, selectedTemplate.id)}`

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#/" aria-label="Little Hello home">
          <span className="brand-mark" aria-hidden="true">✦</span><span>Little Hello</span>
        </a>
        <p className="privacy-note"><span aria-hidden="true">⌁</span> Made privately on your device</p>
      </header>
      <main>
        <section className="hero-section" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="eyebrow">A small gesture, made special</p>
            <h1 id="welcome-title">Make someone’s day.</h1>
            <p className="hero-text">Choose a beautiful design, add your words, and share a little hello. No account needed.</p>
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
                  <div className={`template-art ${template.artClass} card-style-${template.style}`} aria-hidden="true">
                    <CardArtwork template={template} />
                  </div>
                  <span className="template-name">{template.name}</span>
                </button>
              ))}
            </div>
            <div className="editor-panel">
              <div className="section-heading compact"><div><p className="step-label">03 <span>of 03</span></p><h2>Write your message</h2></div></div>
              <div className="form-fields">
                <label><span>To <small>optional</small></span><input value={draft.to} maxLength={60} onChange={(event) => updateDraft('to', event.target.value)} placeholder="Who is this for?" /></label>
                <label><span>Your message <small>{draft.message.length}/500</small></span><textarea value={draft.message} maxLength={500} onChange={(event) => updateDraft('message', event.target.value)} placeholder="Write something from the heart..." rows={5} /></label>
                <label><span>From <small>optional</small></span><input value={draft.from} maxLength={60} onChange={(event) => updateDraft('from', event.target.value)} placeholder="Your name" /></label>
              </div>
              <div className="font-picker" aria-labelledby="message-font-title">
                <div className="font-picker-heading">
                  <span id="message-font-title">Personality for your message</span>
                  <small>Recommended: {getMessageFont(selectedTemplate.typography.defaultMessageFont).name}</small>
                </div>
                <div className="font-options" role="listbox" aria-label="Message font">
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
              </div>
              <div className="share-actions">
                <button className="primary-action" type="button" onClick={shareCard}>Share Card</button>
                <button className="secondary-action" type="button" onClick={copyLink}>Copy Link</button>
                <button className="secondary-action" type="button" onClick={exportCard} disabled={isExporting}>{isExporting ? 'Preparing…' : 'Download Card'}</button>
              </div>
              <label className="share-link-field">Share link
                <input readOnly aria-label="Share link" value={currentUrl} onFocus={(event) => event.currentTarget.select()} />
              </label>
              <p className="action-status" role="status" aria-live="polite">{notice || `Your share link is ready: ${currentUrl}`}</p>
            </div>
          </div>
          <aside className="preview-column" aria-label="Live card preview">
            <div className="preview-label"><span className="live-dot" /> Live preview</div>
            <CardRenderer card={draft} template={selectedTemplate} />
            <p className="preview-footnote">Your card is created on your device.<br />We don’t need to store it.</p>
          </aside>
        </section>
      </main>
      <footer className="site-footer">
        <span>Made for meaningful moments. Works offline after your first visit.</span>
        <span>Created by <a href="https://www.linkedin.com/in/nourileesantos/" target="_blank" rel="noopener noreferrer">Nourilee Santos</a></span>
      </footer>
    </div>
  )
}

export default App
