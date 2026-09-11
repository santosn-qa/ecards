import { useMemo, useState } from 'react'
import { cardTemplates, occasions, type CardDraft, type Occasion } from './data/templates'
import './App.css'

const emptyDraft: CardDraft = {
  to: '',
  message: '',
  from: '',
}

function App() {
  const [occasion, setOccasion] = useState<Occasion>('Birthday')
  const [selectedTemplateId, setSelectedTemplateId] = useState(cardTemplates[0].id)
  const [draft, setDraft] = useState<CardDraft>(emptyDraft)

  const visibleTemplates = useMemo(
    () => cardTemplates.filter((template) => template.occasion === occasion),
    [occasion],
  )
  const selectedTemplate =
    cardTemplates.find((template) => template.id === selectedTemplateId) ??
    visibleTemplates[0]

  function handleOccasionChange(nextOccasion: Occasion) {
    setOccasion(nextOccasion)
    const firstTemplate = cardTemplates.find((template) => template.occasion === nextOccasion)
    if (firstTemplate) setSelectedTemplateId(firstTemplate.id)
  }

  function updateDraft(field: keyof CardDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#/" aria-label="Little Hello home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>Little Hello</span>
        </a>
        <p className="privacy-note"><span aria-hidden="true">⌁</span> Made privately on your device</p>
      </header>

      <main>
        <section className="hero-section" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="eyebrow">A small gesture, made special</p>
            <h1 id="welcome-title">Make someone’s day.</h1>
            <p className="hero-text">
              Choose a beautiful design, add your words, and share a little hello.
              No account needed.
            </p>
          </div>
          <div className="hero-sparkles" aria-hidden="true">
            <span>✦</span><span>✧</span><span>·</span>
          </div>
        </section>

        <section className="step-section" aria-labelledby="occasion-title">
          <div className="section-heading">
            <div>
              <p className="step-label">01 <span>of 03</span></p>
              <h2 id="occasion-title">What’s the occasion?</h2>
            </div>
            <span className="section-hint">Pick one to get started</span>
          </div>
          <div className="occasion-list" role="list" aria-label="Card occasions">
            {occasions.map((item) => (
              <button
                className={`occasion-chip ${occasion === item ? 'is-selected' : ''}`}
                key={item}
                type="button"
                onClick={() => handleOccasionChange(item)}
                aria-pressed={occasion === item}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="workspace" aria-label="Card creator">
          <div className="design-column">
            <div className="section-heading compact">
              <div>
                <p className="step-label">02 <span>of 03</span></p>
                <h2>Choose a design</h2>
              </div>
              <span className="section-hint">{visibleTemplates.length} designs</span>
            </div>
            <div className="template-grid">
              {visibleTemplates.map((template) => (
                <button
                  className={`template-button ${selectedTemplate.id === template.id ? 'is-selected' : ''}`}
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  aria-label={`Choose ${template.name} design`}
                  aria-pressed={selectedTemplate.id === template.id}
                >
                  <div className={`template-art ${template.artClass}`}>
                    <span className="art-sun" aria-hidden="true" />
                    <span className="art-shape art-shape-one" aria-hidden="true" />
                    <span className="art-shape art-shape-two" aria-hidden="true" />
                    <span className="art-stars" aria-hidden="true">✦  ·  ✧</span>
                  </div>
                  <span className="template-name">{template.name}</span>
                </button>
              ))}
            </div>

            <div className="editor-panel">
              <div className="section-heading compact">
                <div>
                  <p className="step-label">03 <span>of 03</span></p>
                  <h2>Write your message</h2>
                </div>
              </div>
              <div className="form-fields">
                <label>
                  <span>To <small>optional</small></span>
                  <input
                    value={draft.to}
                    maxLength={60}
                    onChange={(event) => updateDraft('to', event.target.value)}
                    placeholder="Who is this for?"
                  />
                </label>
                <label>
                  <span>Your message <small>{draft.message.length}/500</small></span>
                  <textarea
                    value={draft.message}
                    maxLength={500}
                    onChange={(event) => updateDraft('message', event.target.value)}
                    placeholder="Write something from the heart..."
                    rows={5}
                  />
                </label>
                <label>
                  <span>From <small>optional</small></span>
                  <input
                    value={draft.from}
                    maxLength={60}
                    onChange={(event) => updateDraft('from', event.target.value)}
                    placeholder="Your name"
                  />
                </label>
              </div>
            </div>
          </div>

          <aside className="preview-column" aria-label="Live card preview">
            <div className="preview-label"><span className="live-dot" /> Live preview</div>
            <article className={`card-preview ${selectedTemplate.previewClass}`}>
              <div className="preview-art" aria-hidden="true">
                <span className="preview-circle" />
                <span className="preview-confetti">✦</span>
                <span className="preview-confetti second">✧</span>
              </div>
              <div className="preview-content">
                <p className="preview-to">{draft.to || 'A little note for you'}</p>
                <p className="preview-message">{draft.message || 'Your message will appear here.'}</p>
                <p className="preview-from">{draft.from ? `— ${draft.from}` : 'With a little love'}</p>
              </div>
            </article>
            <p className="preview-footnote">Your card is created on your device.<br />We don’t need to store it.</p>
          </aside>
        </section>
      </main>

      <footer className="site-footer">
        <span>Made for meaningful moments.</span>
        <span>Works offline after your first visit.</span>
      </footer>
    </div>
  )
}

export default App
