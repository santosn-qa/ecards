import { expect, test } from '@playwright/test'

test('creates a card and updates the live preview', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Make someone’s day.' })).toBeVisible()
  await page.getByRole('button', { name: 'Thank you' }).click()
  await page.getByRole('button', { name: 'Choose Bloom design' }).click()
  await page.getByRole('textbox', { name: 'To optional' }).fill('Grandma')
  await page.getByRole('textbox', { name: /Your message/ }).fill('Thank you for always being there.')
  await page.getByRole('textbox', { name: 'From optional' }).fill('Nouri')

  const preview = page.getByRole('complementary', { name: 'Live card preview' })
  await expect(preview).toContainText('Grandma')
  await expect(preview).toContainText('Thank you for always being there.')
  await expect(preview).toContainText('— Nouri')
})
