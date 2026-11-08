import { expect, test, type Page } from '@playwright/test'
import { encodeCard } from '../../src/card/codec'
import { decodeCardHash } from '../../src/card/codec'

const who = (page: Page) => page.getByRole('group', { name: 'Who would you like to send a card to?' })
const what = (page: Page) => page.getByRole('group', { name: 'What would you like to say?' })
const message = (page: Page) => page.getByRole('textbox', { name: /Your message/ })
const preview = (page: Page) => page.getByRole('complementary', { name: 'Live card preview' })
const library = (page: Page) => page.getByRole('region', { name: 'Ready-made messages' })

test.describe('home flow: who, what and how', () => {
  test('starts with who, then what, then how, before designs and the message', async ({ page }) => {
    await page.goto('/')
    const headings = ['Who would you like to send a card to?', 'What would you like to say?', 'How would you like to make it?', 'Choose a design', 'Your message']
    const tops = await Promise.all(headings.map(async (name) => (await page.getByRole('heading', { name }).boundingBox())!.y))
    expect(tops).toEqual([...tops].sort((a, b) => a - b))
    await expect(page.getByText('01 of 05')).toBeVisible()
  })

  test('“Create Card” takes you to the first question', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Create Card' }).click()
    await expect.poll(async () => (await page.getByRole('heading', { name: 'Who would you like to send a card to?' }).boundingBox())!.y).toBeLessThan(200)
  })

  test('shows the popular choices as large buttons, with the rest behind “See more”', async ({ page }) => {
    await page.goto('/')
    for (const label of ['Mom', 'Dad', 'Husband / Wife', 'Grandma / Grandpa', 'Teacher', 'Other']) {
      await expect(who(page).getByRole('button', { name: label, exact: true })).toBeVisible()
    }
    for (const label of ['Birthday', 'Anniversary', 'Get well soon', 'Mother’s Day', 'Christmas', 'Just because']) {
      await expect(what(page).getByRole('button', { name: label, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Aunt', exact: true })).toHaveCount(0)
    await who(page).getByRole('button', { name: 'See more' }).click()
    await expect(page.getByRole('group', { name: 'Family' }).getByRole('button', { name: 'Aunt', exact: true })).toBeVisible()
  })

  test('“See more” search finds people and occasions by everyday words, and the choice stays visible', async ({ page }) => {
    await page.goto('/')
    await who(page).getByRole('button', { name: 'See more' }).click()
    await page.getByRole('searchbox', { name: 'Search for someone' }).fill('auntie')
    await page.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Aunt' }).click()
    await expect(who(page).getByRole('button', { name: 'Aunt', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('searchbox', { name: 'Search for someone' })).toHaveCount(0)

    await what(page).getByRole('button', { name: 'See more' }).click()
    await page.getByRole('searchbox', { name: 'Search for an occasion' }).fill('housewarming')
    await page.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'New home' }).click()
    await expect(what(page).getByRole('button', { name: 'New home', exact: true })).toHaveAttribute('aria-pressed', 'true')

    await what(page).getByRole('button', { name: 'See more' }).click()
    await page.getByRole('searchbox', { name: 'Search for an occasion' }).fill('zebra')
    await expect(page.getByText('Nothing matches “zebra”. Try another word, or pick one of the choices above.')).toBeVisible()
  })

  test('choosing an occasion shows designs that fit it', async ({ page }) => {
    await page.goto('/')
    await what(page).getByRole('button', { name: 'Anniversary', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Choose Love letter design' })).toBeVisible()
    await what(page).getByRole('button', { name: 'Mother’s Day', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Choose Bloom design' })).toBeVisible()
  })

  test('“Choose a message” lists messages for that person and occasion, and puts the chosen one in the card', async ({ page }) => {
    await page.goto('/')
    await who(page).getByRole('button', { name: 'Mom', exact: true }).click()
    await what(page).getByRole('button', { name: 'Birthday', exact: true }).click()
    await page.getByRole('button', { name: /Choose a message/ }).click()
    const cards = library(page).getByRole('listitem')
    await expect(cards).toHaveCount(4)
    await expect(cards.first()).toContainText('Mom')
    await library(page).getByRole('button', { name: /Show more messages/ }).click()
    await expect(cards).toHaveCount(8)

    const text = await cards.nth(1).locator('.message-card-text').innerText()
    await cards.nth(1).getByRole('button', { name: 'Use This Message' }).click()
    await expect(message(page)).toHaveValue(text)
    await expect(preview(page)).toContainText(text)

    // The chosen message is fully editable, and the share link carries the edit.
    await message(page).fill(`${text} See you Sunday!`)
    await expect.poll(async () => {
      const result = await decodeCardHash(new URL(await page.getByRole('textbox', { name: 'Share link' }).inputValue()).hash)
      return result?.ok ? result.card.message : null
    }).toBe(`${text} See you Sunday!`)
  })

  test('asks before a ready-made message replaces words the person wrote', async ({ page }) => {
    await page.goto('/')
    await what(page).getByRole('button', { name: 'Thank you', exact: true }).click()
    await message(page).fill('My own words.')
    await page.getByRole('button', { name: /Choose a message/ }).click()
    const first = library(page).getByRole('listitem').first()
    await first.getByRole('button', { name: 'Use This Message' }).click()
    await expect(first.getByText('This will replace the message you wrote. Use this one instead?')).toBeVisible()
    await first.getByRole('button', { name: 'Keep my message' }).click()
    await expect(message(page)).toHaveValue('My own words.')
    await first.getByRole('button', { name: 'Use This Message' }).click()
    await first.getByRole('button', { name: 'Yes, use this message' }).click()
    await expect(message(page)).not.toHaveValue('My own words.')
  })

  test('falls back to a related occasion’s messages, and says so', async ({ page }) => {
    await page.goto('/')
    await what(page).getByRole('button', { name: 'See more' }).click()
    await page.getByRole('searchbox', { name: 'Search for an occasion' }).fill('condolences')
    await page.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Condolences' }).click()
    await page.getByRole('button', { name: /Choose a message/ }).click()
    await expect(library(page).getByText('Here are some “Sympathy” messages that fit well.')).toBeVisible()
    await expect(library(page).getByRole('listitem').first()).toContainText(/loss|sympathy|thinking of you/i)
  })

  test('browsing works without choosing a recipient', async ({ page }) => {
    await page.goto('/')
    await what(page).getByRole('button', { name: 'Get well soon', exact: true }).click()
    await page.getByRole('button', { name: /Choose a message/ }).click()
    await expect(library(page).getByRole('listitem').first()).toContainText(/well|rest|recover/i)
  })

  test('“Write my own” goes straight to the message box', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Write my own/ }).click()
    await expect(message(page)).toBeFocused()
    await page.keyboard.type('Typed straight away.')
    await expect(preview(page)).toContainText('Typed straight away.')
  })

  test('“Change Message” in the editor opens the ready-made messages', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Choose a ready-made message' }).click()
    await expect(library(page)).toBeVisible()
    await library(page).getByRole('listitem').first().getByRole('button', { name: 'Use This Message' }).click()
    await expect(page.getByRole('button', { name: 'Change Message' })).toBeVisible()
  })

  test('“Start Over” clears the card after asking, and returns to the first question', async ({ page }) => {
    await page.goto('/')
    await who(page).getByRole('button', { name: 'Dad', exact: true }).click()
    await what(page).getByRole('button', { name: 'Christmas', exact: true }).click()
    await message(page).fill('Merry Christmas!')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('button', { name: 'Start Over' }).click()
    await expect(message(page)).toHaveValue('Merry Christmas!')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Start Over' }).click()
    await expect(message(page)).toHaveValue('')
    await expect(who(page).getByRole('button', { name: 'Dad', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(what(page).getByRole('button', { name: 'Christmas', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })

  test('older share links still open, whatever the new steps hold', async ({ page }) => {
    const payload = await encodeCard({ to: 'Gran', message: 'Thinking of you.', from: 'Ana' }, 'just-because-doodle-01')
    await page.goto(`/#/card/v2/${payload}`)
    await expect(page.getByRole('heading', { name: 'Gran, this is for you.' })).toBeVisible()
    await expect(page.getByRole('article')).toContainText('Thinking of you.')
  })

  test('is comfortable on a phone: large targets, readable text, no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/')
    await who(page).getByRole('button', { name: 'See more' }).click()
    await page.getByRole('button', { name: /Choose a message/ }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    const targets = await page.locator('.choice-button, .how-option, .message-card-use, .message-show-more').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
    expect(targets.length).toBeGreaterThan(20)
    expect(Math.min(...targets)).toBeGreaterThanOrEqual(48)
    const smallest = await page.locator('.choice-step, .how-step').evaluateAll((sections) =>
      Math.min(...sections.flatMap((section) => [...section.querySelectorAll('h2, h3, button, label, p:not(.step-label)')].map((node) => parseFloat(getComputedStyle(node).fontSize)))))
    expect(smallest).toBeGreaterThanOrEqual(15)
  })

  test('can be used with the keyboard alone', async ({ page }) => {
    await page.goto('/')
    const mom = who(page).getByRole('button', { name: 'Mom', exact: true })
    await mom.focus()
    await page.keyboard.press('Enter')
    await expect(mom).toHaveAttribute('aria-pressed', 'true')
    const birthday = what(page).getByRole('button', { name: 'Birthday', exact: true })
    await birthday.focus()
    await page.keyboard.press('Space')
    await expect(birthday).toHaveAttribute('aria-pressed', 'true')
    const choose = page.getByRole('button', { name: /Choose a message/ })
    await choose.focus()
    await page.keyboard.press('Enter')
    await library(page).getByRole('button', { name: 'Use This Message' }).first().focus()
    await page.keyboard.press('Enter')
    await expect(message(page)).not.toHaveValue('')
  })
})
