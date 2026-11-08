import { useId, useState } from 'react'

export type Choice = { id: string; label: string }
export type ChoiceGroup = { label: string; items: Choice[] }

type ChoiceStepProps = {
  id: string
  step: string
  title: string
  hint?: string
  popular: Choice[]
  groups: ChoiceGroup[]
  selectedId: string | null
  /** The selected choice's label, for picks made through "See more" that aren't in the popular list. */
  selectedLabel?: string
  onSelect: (id: string) => void
  search: (query: string) => Choice[]
  searchLabel: string
  searchExample: string
}

/**
 * One question with large answer buttons: the popular answers first, the rest
 * behind "See more" with a search box and grouped lists. No dropdowns, no
 * typing required, nothing that depends on hover.
 */
export function ChoiceStep({ id, step, title, hint, popular, groups, selectedId, selectedLabel, onSelect, search, searchLabel, searchExample }: ChoiceStepProps) {
  const [showMore, setShowMore] = useState(false)
  const [query, setQuery] = useState('')
  const listId = useId()
  const isPopular = popular.some((item) => item.id === selectedId)
  const visiblePopular = selectedId && !isPopular && selectedLabel ? [...popular, { id: selectedId, label: selectedLabel }] : popular
  const results = query.trim() ? search(query) : null

  function choose(choiceId: string) {
    onSelect(choiceId)
    setShowMore(false)
    setQuery('')
  }

  return (
    <section className="step-section choice-step" aria-labelledby={`${id}-title`} id={id}>
      <div className="section-heading">
        <div><p className="step-label">{step}</p><h2 id={`${id}-title`}>{title}</h2></div>
        {hint && <span className="section-hint">{hint}</span>}
      </div>
      <div className="choice-grid" role="group" aria-labelledby={`${id}-title`}>
        {visiblePopular.map((item) => (
          <button key={item.id} type="button" className={`choice-button ${selectedId === item.id ? 'is-selected' : ''}`} aria-pressed={selectedId === item.id} onClick={() => choose(item.id)}>
            {item.label}
          </button>
        ))}
        <button type="button" className="choice-button choice-more" aria-expanded={showMore} aria-controls={listId} onClick={() => setShowMore((open) => !open)}>
          {showMore ? 'Show fewer' : 'See more'}
        </button>
      </div>
      {showMore && (
        <div className="choice-more-panel" id={listId}>
          <label className="choice-search">
            <span>{searchLabel}</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Type a word, for example “${searchExample}”`} />
          </label>
          {results ? (
            results.length > 0 ? (
              <div className="choice-grid choice-grid-compact" role="group" aria-label="Search results">
                {results.map((item) => (
                  <button key={item.id} type="button" className={`choice-button ${selectedId === item.id ? 'is-selected' : ''}`} aria-pressed={selectedId === item.id} onClick={() => choose(item.id)}>{item.label}</button>
                ))}
              </div>
            ) : (
              <p className="choice-empty">Nothing matches “{query.trim()}”. Try another word, or pick one of the choices above.</p>
            )
          ) : (
            groups.map((group) => (
              <div className="choice-group" key={group.label} role="group" aria-label={group.label}>
                <h3>{group.label}</h3>
                <div className="choice-grid choice-grid-compact">
                  {group.items.map((item) => (
                    <button key={item.id} type="button" className={`choice-button ${selectedId === item.id ? 'is-selected' : ''}`} aria-pressed={selectedId === item.id} onClick={() => choose(item.id)}>{item.label}</button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}
