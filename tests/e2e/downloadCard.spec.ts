import { test, expect, type Page } from '@playwright/test'
import { encodeCard } from '../../src/card/codec'
import { cardTemplates, type CardDraft } from '../../src/data/templates'

type DrawnText = { text: string; x: number; y: number; width: number; font: string }

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1350
// Message column on full-bleed cards: starts at x=80 and is 550px wide, matching the preview's text column.
const MESSAGE_RIGHT_EDGE = 80 + 550

const longMessage = 'Happy 89th Birthday, Lola!\nThanking God for the precious gift of your life and 89 years of His abundant blessings. May He continue to bless you with peace, good health, and strength, and shower our family with His love and grace. May your life always be a beautiful testament to His goodness and faithfulness. Wishing you a truly blessed and meaningful birthday!❤️'

// The longest message the editor allows (maxLength 500).
const maxLengthMessage = 'Thank you for every small kindness, every phone call, and every reminder that home is wherever we are together. '.repeat(5).slice(0, 500).trim()

// Lines may break mid-word (overflow-wrap: anywhere), so compare the drawn text with whitespace removed.
const normalize = (value: string) => value.replace(/\s+/g, '')

// Records every canvas fillText call so tests can check what the exported PNG actually contains and where.
async function recordCanvasText(page: Page) {
  await page.addInitScript(() => {
    const drawn: DrawnText[] = []
    ;(window as unknown as { __drawnText: DrawnText[] }).__drawnText = drawn
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      drawn.push({ text, x, y, width: this.measureText(text).width, font: this.font })
      return original.call(this, text, x, y, ...rest)
    }
  })
}

async function downloadAndReadDrawnText(page: Page) {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Card' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^little-hello-.+\.png$/)
  return page.evaluate(() => (window as unknown as { __drawnText: DrawnText[] }).__drawnText)
}

// Supporting text (tagline, to, from) uses the Inter stack; everything else is the message.
function messageLines(drawn: DrawnText[]) {
  return drawn.filter(({ font }) => !font.includes('Inter'))
}

function expectFullMessageInsideCard(drawn: DrawnText[], message: string, from: string) {
  const lines = messageLines(drawn)
  expect(normalize(lines.map(({ text }) => text).join(''))).toBe(normalize(message))

  const signature = drawn.find(({ text }) => text === `— ${from}`)
  expect(signature, 'signature line is drawn').toBeDefined()

  for (const line of lines) {
    expect(line.x, `"${line.text}" starts inside the card`).toBeGreaterThanOrEqual(0)
    expect(line.x + line.width, `"${line.text}" stays inside the message column`).toBeLessThanOrEqual(MESSAGE_RIGHT_EDGE + 1)
    expect(line.y, `"${line.text}" is inside the card`).toBeLessThan(CANVAS_HEIGHT)
    expect(line.y, `"${line.text}" sits above the signature`).toBeLessThan(signature!.y - 40)
  }
  expect(Math.max(...lines.map(({ x, width }) => x + width))).toBeLessThanOrEqual(CANVAS_WIDTH)
}

test.describe('Download Card PNG', () => {
  test.beforeEach(async ({ page }) => {
    await recordCanvasText(page)
  })

  test('includes the whole long message when downloading from the editor', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'To optional' }).fill('Lola Nita')
    await page.getByRole('textbox', { name: /Your message/ }).fill(longMessage)
    await page.getByRole('textbox', { name: 'From optional' }).fill('Santos Fam')

    const drawn = await downloadAndReadDrawnText(page)

    expectFullMessageInsideCard(drawn, longMessage, 'Santos Fam')
    expect(drawn.some(({ text }) => text === 'Lola Nita')).toBe(true)
  })

  for (const template of cardTemplates) {
    test(`fits a max-length message on the ${template.name} card from a shared link`, async ({ page }) => {
      const card: CardDraft = { to: 'Grandma', message: maxLengthMessage, from: 'Santos Fam' }
      await page.goto(`/#/card/v2/${await encodeCard(card, template.id)}`)

      const drawn = await downloadAndReadDrawnText(page)

      expectFullMessageInsideCard(drawn, maxLengthMessage, 'Santos Fam')
    })
  }

  test('breaks a single overlong word instead of letting it run off the card', async ({ page }) => {
    const unbrokenWord = 'Congratulations'.repeat(6)
    const card: CardDraft = { to: '', message: unbrokenWord, from: 'Alex' }
    await page.goto(`/#/card/v2/${await encodeCard(card, cardTemplates[0].id)}`)

    const drawn = await downloadAndReadDrawnText(page)

    expect(messageLines(drawn).length).toBeGreaterThan(1)
    expect(messageLines(drawn).map(({ text }) => text).join('')).toBe(unbrokenWord)
    expectFullMessageInsideCard(drawn, unbrokenWord, 'Alex')
  })
})
