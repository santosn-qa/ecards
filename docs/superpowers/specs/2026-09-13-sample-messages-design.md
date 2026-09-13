# Sample Message Picker — Design

## Goal

Give users a fast way to start their message instead of facing a blank textarea. Add a small set of static, hand-written sample messages the user can pick from per occasion, right in the existing constrained editor.

## Non-goals

- Per-template tailoring of samples (samples are scoped to occasion, not template).
- Tone filtering, search, or a "see more" browsing UI.
- Personalization placeholders inside sample text (e.g. inserting the `to`/`from` name into the sample).
- Editing/managing sample content from within the app.
- Internationalization of sample content.
- Hover-preview tooltips (chip labels are tone names only; adding a `title` tooltip later is a trivial follow-up, not part of this work).

## Data model

New file `src/data/sampleMessages.ts`, following the existing static-registry pattern used by `src/data/typography.ts`:

```ts
import type { Occasion } from './templates'

export type SampleMessage = {
  tone: string
  text: string
}

export const sampleMessagesByOccasion: Record<Occasion, SampleMessage[]> = {
  Birthday: [ /* ... */ ],
  'Thank you': [ /* ... */ ],
  Congratulations: [ /* ... */ ],
  Love: [ /* ... */ ],
  'Just because': [ /* ... */ ],
}

export function getSampleMessages(occasion: Occasion): SampleMessage[] {
  return sampleMessagesByOccasion[occasion]
}
```

Each occasion gets 3–4 samples spanning different tones (Heartfelt, Playful, Short & sweet, and Formal where it fits the occasion). All sample text stays within the existing 500-character message limit (`maxLength={500}` on the textarea in `App.tsx`).

### Sample content (final copy)

**Birthday**
- Heartfelt: "Wishing you a birthday as wonderful as you are. Here's to another year of chasing joy and making memories. Happy birthday!"
- Playful: "Another year older, another year of being awesome. Go eat some cake, you've earned it. Happy birthday!"
- Short & sweet: "Happy birthday! Hope your day is full of cake, laughter, and everything you love."

**Thank you**
- Heartfelt: "I don't say it enough, but I'm so grateful for you. Thank you for everything you do — it means more than words can say."
- Playful: "You plus kindness equals the best combo ever. Thanks a million for being amazing!"
- Short & sweet: "Just a little note to say... thank you. Truly."
- Formal: "Please accept my sincere thanks for your generosity and thoughtfulness. It is deeply appreciated."

**Congratulations**
- Heartfelt: "You worked so hard for this, and it shows. I'm so proud of you and everything you've achieved. Congratulations!"
- Playful: "Look at you, being all successful and stuff. Congrats, you rockstar!"
- Short & sweet: "Congratulations! You did it, and you deserve every bit of this moment."
- Formal: "Congratulations on this well-earned achievement. Wishing you continued success ahead."

**Love**
- Heartfelt: "Every day with you feels like a gift. Thank you for loving me the way you do. I love you more than words can hold."
- Playful: "You're stuck with me forever now, sorry not sorry. Love you to the moon and back!"
- Short & sweet: "Just wanted to remind you: I love you. Always have, always will."

**Just because**
- Heartfelt: "No reason needed — just wanted you to know you're thought of today, and that you matter more than you know."
- Playful: "Sending you a random burst of good vibes because why not? Hope this made you smile."
- Short & sweet: "Just because. Thinking of you today."

## UI

A chip row is inserted directly above the message `<textarea>` in the "Write your message" section of the editor panel (`src/App.tsx`), inside/alongside the existing message `<label>`.

- Chips render one per sample for the currently selected `occasion`, in the order they appear in `sampleMessagesByOccasion`.
- Chip label is the tone name only (e.g. "Heartfelt", "Playful", "Short & sweet", "Formal").
- Each chip is a `<button type="button">`, visually consistent with the existing `.occasion-chip` / `.font-option` button styles (new class `.sample-chip`, styled in `App.css` alongside those).
- The chip row has `role="list"` and `aria-label="Sample messages"`, matching the `occasion-list` pattern (`role="list"` on the container; each chip is a plain button, not `role="listitem"`, matching how `occasion-chip` is already done).

### Behavior

- Clicking a chip calls the existing `updateDraft('message', text)`, which also clears `notice` — identical to any other manual edit to the field. No confirmation dialog, even if the textarea already has text: the click always replaces the current message.
- Chips are not a toggle and carry no "selected" persisted state — after filling, the textarea is freely editable and typing does not re-highlight or dismiss any chip.
- The chip set is derived from `occasion` (the top-level occasion state), not from `selectedTemplate` — switching the selected template within the same occasion does not change the chips; changing occasion swaps the whole set.
- The character counter (`{draft.message.length}/500`) updates immediately after a chip fill, same as typing.

## Testing

One new Playwright e2e test in `tests/e2e/smoke.spec.ts`, following existing conventions (`page.getByRole` locators, no test IDs):

- Load the app, confirm the default occasion (Birthday) shows its sample chips.
- Click a sample chip (e.g. "Heartfelt").
- Assert the message textarea's value equals that sample's exact text.
- Assert the live preview (`CardRenderer`, rendered via `role="article"` per existing tests) contains that text.
- Switch occasion to "Thank you" and assert its "Formal" chip is visible, then assert no "Formal" chip is rendered when the occasion is "Birthday" (Birthday's tone set has no Formal sample) — confirming the chip set actually changes with occasion.

## Files touched

- New: `src/data/sampleMessages.ts`
- Modify: `src/App.tsx` (render chip row, no new state needed — reuses `updateDraft`)
- Modify: `src/App.css` (`.sample-chip` styles, reusing existing chip/button visual language)
- Modify: `tests/e2e/smoke.spec.ts` (new test)
- Modify: `docs/AI-PROJECT-STATUS.md` (note the new feature under Current functionality)
