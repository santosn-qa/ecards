import { expect, test, type Page } from '@playwright/test'
import { decodeCardHash, encodeCard } from '../../src/card/codec'
import { openDesigns, openEditor } from './helpers'

const what = (page: Page) => page.getByRole('group', { name: 'What would you like to say?' })
const message = (page: Page) => page.getByRole('textbox', { name: /Your message/ })
const preview = (page: Page) => page.getByRole('complementary', { name: 'Live card preview' })
const library = (page: Page) => page.getByRole('region', { name: 'Ready-made messages' })
const back = (page: Page) => page.getByRole('button', { name: '← Go Back' })

test.describe('home: two ways to make a card', () => {
  test('offers exactly two choices, and nothing else to fill in first', async ({ page }) => {
    await page.goto('/')
    const choices = page.getByRole('group', { name: 'How would you like to make your card?' }).getByRole('button')
    await expect(choices).toHaveCount(2)
    await expect(choices.nth(0)).toContainText('Make it for me')
    await expect(choices.nth(1)).toContainText('Make it myself')
    await expect(page.getByRole('link', { name: 'Create Card' })).toHaveCount(0)
    await expect(page.getByText('Who would you like to send a card to?')).toHaveCount(0)
    await expect(message(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Choose a design' })).toHaveCount(0)
  })

  test('“Make it myself” is three steps: occasion, design, message — one at a time', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Make it myself/ }).click()
    await expect(page.getByText('Make it myself · Step 1 of 3')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Choose a design' })).toHaveCount(0)

    await what(page).getByRole('button', { name: 'Anniversary', exact: true }).click()
    await expect(page.getByText('Make it myself · Step 2 of 3')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Choose Love letter design' })).toBeVisible()
    await expect(message(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Choose Love letter design' }).click()
    await page.getByRole('button', { name: 'Next: Your message →' }).click()
    await expect(page.getByText('Make it myself · Step 3 of 3')).toBeVisible()
    await message(page).fill('Happy anniversary, my love.')
    await expect(preview(page)).toContainText('Happy anniversary, my love.')
    await expect(preview(page).locator('.card-preview')).toHaveClass(/preview-love-letter-card/)
  })

  test('the message step offers both a ready-made message and your own words', async ({ page }) => {
    await openEditor(page)
    await expect(message(page)).toBeVisible()
    await page.getByRole('button', { name: 'Choose a ready-made message' }).click()
    const cards = library(page).getByRole('listitem')
    await expect(cards).toHaveCount(4)
    await library(page).getByRole('button', { name: /Show more messages/ }).click()
    await expect(cards).toHaveCount(8)
    const text = await cards.nth(1).locator('.message-card-text').innerText()
    await cards.nth(1).getByRole('button', { name: 'Use This Message' }).click()
    await expect(message(page)).toHaveValue(text)
    await expect(library(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Change Message' })).toBeVisible()

    // Fully editable, and the share link carries the edit.
    await message(page).fill(`${text} See you Sunday!`)
    await expect.poll(async () => {
      const result = await decodeCardHash(new URL(await page.getByRole('textbox', { name: 'Share link' }).inputValue()).hash)
      return result?.ok ? result.card.message : null
    }).toBe(`${text} See you Sunday!`)
  })

  test('who the card is for is simply the To field', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('textbox', { name: 'To optional' }).fill('Mom')
    await expect(preview(page)).toContainText('Mom')
    await expect(page.getByText('Who would you like to send a card to?')).toHaveCount(0)
  })

  test('asks before a ready-made message replaces words the person wrote', async ({ page }) => {
    await openEditor(page, { occasion: 'Thank you' })
    await message(page).fill('My own words.')
    await page.getByRole('button', { name: 'Change Message' }).click()
    const first = library(page).getByRole('listitem').first()
    await first.getByRole('button', { name: 'Use This Message' }).click()
    await expect(first.getByText('This will replace the message you wrote. Use this one instead?')).toBeVisible()
    await first.getByRole('button', { name: 'Keep my message' }).click()
    await expect(message(page)).toHaveValue('My own words.')
    await first.getByRole('button', { name: 'Use This Message' }).click()
    await first.getByRole('button', { name: 'Yes, use this message' }).click()
    await expect(message(page)).not.toHaveValue('My own words.')
  })

  test('“See more” search finds less common occasions, and related messages are offered', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Make it myself/ }).click()
    await what(page).getByRole('button', { name: 'See more' }).click()
    await page.getByRole('searchbox', { name: 'Search for an occasion' }).fill('condolences')
    await page.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Condolences' }).click()
    await page.getByRole('button', { name: 'Next: Your message →' }).click()
    await page.getByRole('button', { name: 'Choose a ready-made message' }).click()
    await expect(library(page).getByText('Here are some “Sympathy” messages that fit well.')).toBeVisible()

    await back(page).click()
    await back(page).click()
    await what(page).getByRole('button', { name: 'See more' }).click()
    await page.getByRole('searchbox', { name: 'Search for an occasion' }).fill('zebra')
    await expect(page.getByText('Nothing matches “zebra”. Try another word, or pick one of the choices above.')).toBeVisible()
  })

  test('Go Back steps back one at a time, keeping what was chosen and written', async ({ page }) => {
    await openEditor(page, { occasion: 'Thank you', design: 'Bloom' })
    await message(page).fill('Thank you so much.')
    await back(page).click()
    await expect(page.getByRole('button', { name: 'Choose Bloom design' })).toHaveAttribute('aria-pressed', 'true')
    await back(page).click()
    await expect(what(page).getByRole('button', { name: 'Thank you', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await back(page).click()
    await expect(page.getByRole('button', { name: /Make it myself/ })).toBeVisible()
    await page.getByRole('button', { name: /Make it myself/ }).click()
    await what(page).getByRole('button', { name: 'Thank you', exact: true }).click()
    await page.getByRole('button', { name: 'Next: Your message →' }).click()
    await expect(message(page)).toHaveValue('Thank you so much.')
  })

  test('“Start Over” asks first, then returns to the two choices with a fresh card', async ({ page }) => {
    await openEditor(page, { occasion: 'Christmas' })
    await message(page).fill('Merry Christmas!')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('button', { name: 'Start Over' }).click()
    await expect(message(page)).toHaveValue('Merry Christmas!')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Start Over' }).click()
    await expect(page.getByRole('button', { name: /Make it myself/ })).toBeVisible()
    await openEditor(page, { goto: false })
    await expect(message(page)).toHaveValue('')
  })

  test('older share links still open', async ({ page }) => {
    const payload = await encodeCard({ to: 'Gran', message: 'Thinking of you.', from: 'Ana' }, 'just-because-doodle-01')
    await page.goto(`/#/card/v2/${payload}`)
    await expect(page.getByRole('heading', { name: 'Gran, this is for you.' })).toBeVisible()
    await expect(page.getByRole('article')).toContainText('Thinking of you.')
  })

  test('is comfortable on a phone: large targets, readable text, no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/')
    const choiceHeights = await page.locator('.mode-option').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
    expect(Math.min(...choiceHeights)).toBeGreaterThanOrEqual(100)
    await page.getByRole('button', { name: /Make it myself/ }).click()
    await what(page).getByRole('button', { name: 'See more' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    const targets = await page.locator('.choice-button, .wizard-back, .wizard-start-over').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
    expect(targets.length).toBeGreaterThan(20)
    expect(Math.min(...targets)).toBeGreaterThanOrEqual(48)
    const smallest = await page.locator('.choice-step, .wizard-bar').evaluateAll((sections) =>
      Math.min(...sections.flatMap((section) => [...section.querySelectorAll('h2, h3, button, label, p')].map((node) => parseFloat(getComputedStyle(node).fontSize)))))
    expect(smallest).toBeGreaterThanOrEqual(15)
    await what(page).getByRole('button', { name: 'Birthday', exact: true }).click()
    await page.getByRole('button', { name: 'Next: Your message →' }).click()
    await page.getByRole('button', { name: 'Choose a ready-made message' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })

  test('can be used with the keyboard alone', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Make it myself/ }).focus()
    await page.keyboard.press('Enter')
    const birthday = what(page).getByRole('button', { name: 'Birthday', exact: true })
    await birthday.focus()
    await page.keyboard.press('Space')
    const next = page.getByRole('button', { name: 'Next: Your message →' })
    await next.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Choose a ready-made message' }).focus()
    await page.keyboard.press('Enter')
    await library(page).getByRole('button', { name: 'Use This Message' }).first().focus()
    await page.keyboard.press('Enter')
    await expect(message(page)).not.toHaveValue('')
  })

  test('choosing an occasion shows designs that fit it', async ({ page }) => {
    await openDesigns(page, { occasion: 'Mother’s Day' })
    await expect(page.getByRole('button', { name: 'Choose Bloom design' })).toBeVisible()
  })
})
