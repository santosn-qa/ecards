# Sample Message Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users fill the message textarea from a small set of static, hand-written sample messages (chips) scoped to the selected occasion, instead of starting from a blank field.

**Architecture:** A new static data module (`src/data/sampleMessages.ts`) exposes 3–4 sample messages per occasion. `App.tsx` renders them as a row of tone-labeled chip buttons directly above the message textarea; clicking a chip calls the existing `updateDraft('message', text)` function, so no new state is introduced. Chips are scoped to the top-level `occasion` state, not the selected template.

**Tech Stack:** TypeScript, React 19, Playwright for tests (this repo has no unit-test framework — pure-logic tests run as plain Node-side Playwright tests, matching the existing `tests/e2e/codec.spec.ts` pattern).

**Reference:** Full design rationale in `docs/superpowers/specs/2026-09-13-sample-messages-design.md`.

---

### Task 1: Sample message data module (pure logic)

**Files:**
- Create: `src/data/sampleMessages.ts`
- Test: `tests/e2e/sampleMessages.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/sampleMessages.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { getSampleMessages, sampleMessagesByOccasion } from '../../src/data/sampleMessages'
import { occasions } from '../../src/data/templates'

test.describe('sample message data', () => {
  test('has at least 3 samples for every occasion', () => {
    occasions.forEach((occasion) => {
      expect(sampleMessagesByOccasion[occasion].length).toBeGreaterThanOrEqual(3)
    })
  })

  test('every sample has a non-empty tone and text within the 500-character message limit', () => {
    occasions.forEach((occasion) => {
      sampleMessagesByOccasion[occasion].forEach((sample) => {
        expect(sample.tone.length).toBeGreaterThan(0)
        expect(sample.text.length).toBeGreaterThan(0)
        expect(sample.text.length).toBeLessThanOrEqual(500)
      })
    })
  })

  test('getSampleMessages returns the same list as the registry for a given occasion', () => {
    expect(getSampleMessages('Birthday')).toBe(sampleMessagesByOccasion.Birthday)
  })

  test('Thank you includes a Formal tone and Birthday does not', () => {
    expect(sampleMessagesByOccasion['Thank you'].some((sample) => sample.tone === 'Formal')).toBe(true)
    expect(sampleMessagesByOccasion.Birthday.some((sample) => sample.tone === 'Formal')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test sampleMessages.spec.ts`
Expected: FAIL — `src/data/sampleMessages.ts` does not exist yet (module not found).

- [ ] **Step 3: Create `src/data/sampleMessages.ts`**

```ts
import type { Occasion } from './templates'

export type SampleMessage = {
  tone: string
  text: string
}

export const sampleMessagesByOccasion: Record<Occasion, SampleMessage[]> = {
  Birthday: [
    { tone: 'Heartfelt', text: "Wishing you a birthday as wonderful as you are. Here's to another year of chasing joy and making memories. Happy birthday!" },
    { tone: 'Playful', text: "Another year older, another year of being awesome. Go eat some cake, you've earned it. Happy birthday!" },
    { tone: 'Short & sweet', text: 'Happy birthday! Hope your day is full of cake, laughter, and everything you love.' },
  ],
  'Thank you': [
    { tone: 'Heartfelt', text: "I don't say it enough, but I'm so grateful for you. Thank you for everything you do — it means more than words can say." },
    { tone: 'Playful', text: 'You plus kindness equals the best combo ever. Thanks a million for being amazing!' },
    { tone: 'Short & sweet', text: 'Just a little note to say... thank you. Truly.' },
    { tone: 'Formal', text: 'Please accept my sincere thanks for your generosity and thoughtfulness. It is deeply appreciated.' },
  ],
  Congratulations: [
    { tone: 'Heartfelt', text: "You worked so hard for this, and it shows. I'm so proud of you and everything you've achieved. Congratulations!" },
    { tone: 'Playful', text: 'Look at you, being all successful and stuff. Congrats, you rockstar!' },
    { tone: 'Short & sweet', text: 'Congratulations! You did it, and you deserve every bit of this moment.' },
    { tone: 'Formal', text: 'Congratulations on this well-earned achievement. Wishing you continued success ahead.' },
  ],
  Love: [
    { tone: 'Heartfelt', text: 'Every day with you feels like a gift. Thank you for loving me the way you do. I love you more than words can hold.' },
    { tone: 'Playful', text: "You're stuck with me forever now, sorry not sorry. Love you to the moon and back!" },
    { tone: 'Short & sweet', text: 'Just wanted to remind you: I love you. Always have, always will.' },
  ],
  'Just because': [
    { tone: 'Heartfelt', text: "No reason needed — just wanted you to know you're thought of today, and that you matter more than you know." },
    { tone: 'Playful', text: 'Sending you a random burst of good vibes because why not? Hope this made you smile.' },
    { tone: 'Short & sweet', text: 'Just because. Thinking of you today.' },
  ],
}

export function getSampleMessages(occasion: Occasion): SampleMessage[] {
  return sampleMessagesByOccasion[occasion]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test sampleMessages.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/sampleMessages.ts tests/e2e/sampleMessages.spec.ts
git commit -m "$(cat <<'EOF'
feat: add static sample message data per occasion

Small hand-written sample sets (Heartfelt/Playful/Short & sweet, plus
Formal where it fits) for each occasion, ready to surface as picker
chips in the editor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Render sample chips in the editor

**Files:**
- Modify: `src/App.tsx:1-14` (imports)
- Modify: `src/App.tsx:298-304` (message field JSX)
- Modify: `src/App.css` (new `.sample-chips`/`.sample-chip` rules)

- [ ] **Step 1: Add the import**

In `src/App.tsx`, add this import alongside the other `./data/...` imports (after line 6, the `cardTemplates, occasions, ...` import):

```tsx
import { getSampleMessages } from './data/sampleMessages'
```

- [ ] **Step 2: Insert the chip row above the message textarea**

In `src/App.tsx`, find this line inside `form-fields` (currently line 302):

```tsx
<label><span>Your message <small>{draft.message.length}/500</small></span><textarea value={draft.message} maxLength={500} onChange={(event) => updateDraft('message', event.target.value)} placeholder="Write something from the heart..." rows={5} /></label>
```

Replace it with:

```tsx
<label>
  <span>Your message <small>{draft.message.length}/500</small></span>
  <div className="sample-chips" role="list" aria-label="Sample messages">
    {getSampleMessages(occasion).map((sample) => (
      <button className="sample-chip" key={sample.tone} type="button" onClick={() => updateDraft('message', sample.text)}>
        {sample.tone}
      </button>
    ))}
  </div>
  <textarea value={draft.message} maxLength={500} onChange={(event) => updateDraft('message', event.target.value)} placeholder="Write something from the heart..." rows={5} />
</label>
```

- [ ] **Step 3: Add chip styles**

In `src/App.css`, add these two rules directly after the `.form-fields` rules (after the line ending `...box-shadow: 0 0 0 3px #d26f4f20; }`, i.e. after the existing `.form-fields input:focus, .form-fields textarea:focus` rule):

```css
.sample-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.sample-chip { min-height: 36px; padding: 0 14px; border: 1px solid #e1d9d4; border-radius: 100px; background: transparent; color: #716965; font-size: .78rem; font-weight: 600; transition: .2s ease; }
.sample-chip:hover { border-color: #d26f4f; background: #fff1ec; color: #b5583d; }
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the app. Confirm sample chips appear above the message field for the default occasion (Birthday), clicking one fills the textarea and updates the live preview, and switching occasion (e.g. to "Thank you") changes the chip set (a "Formal" chip appears).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "$(cat <<'EOF'
feat: surface sample message chips above the editor textarea

Chips are scoped to the selected occasion and fill the message field
via the existing updateDraft path, so no new state was needed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Playwright e2e coverage for the chip picker

**Files:**
- Modify: `tests/e2e/smoke.spec.ts` (new test, added after the `'creates a card and updates the live preview'` test)

- [ ] **Step 1: Add the test**

In `tests/e2e/smoke.spec.ts`, add this test immediately after `'creates a card and updates the live preview'` (after its closing `})`, currently ending at line 149):

```ts
test('fills the message from a sample chip, scoped to the selected occasion', async ({ page }) => {
  await page.goto('/')

  const preview = page.getByRole('complementary', { name: 'Live card preview' })
  const messageField = page.getByRole('textbox', { name: /Your message/ })

  await page.getByRole('button', { name: 'Heartfelt' }).click()
  await expect(messageField).toHaveValue(/Wishing you a birthday/)
  await expect(preview).toContainText('Wishing you a birthday')

  await expect(page.getByRole('button', { name: 'Formal' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Thank you' }).click()
  await expect(page.getByRole('button', { name: 'Formal' })).toBeVisible()

  await messageField.fill('typed text should be replaceable')
  await page.getByRole('button', { name: 'Short & sweet' }).click()
  await expect(messageField).toHaveValue('Just a little note to say... thank you. Truly.')
})
```

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all tests pass, including the new one.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
test: cover the sample message chip picker

Verifies a chip fills the message field and preview, that the chip
set changes with occasion, and that clicking a chip replaces
already-typed text.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Update project status doc and final verification

**Files:**
- Modify: `docs/AI-PROJECT-STATUS.md`

- [ ] **Step 1: Update the status doc**

In `docs/AI-PROJECT-STATUS.md`, under `## Current functionality`, add a new bullet after "Constrained editor and live preview":

```
- Static per-occasion sample message chips in the editor
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: all tests pass (includes `sampleMessages.spec.ts`, `codec.spec.ts`, `support.spec.ts`, and `smoke.spec.ts`).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: builds cleanly with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add docs/AI-PROJECT-STATUS.md
git commit -m "$(cat <<'EOF'
docs: note the sample message chip picker in project status

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
