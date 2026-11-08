import type { Page } from '@playwright/test'

/**
 * "Make it myself", steps 1–2, landing on step 3 (the message editor).
 * Optionally picks an occasion (default Birthday) and a design by name.
 */
export async function openEditor(page: Page, options: { occasion?: string; design?: string; goto?: boolean } = {}) {
  if (options.goto !== false) await page.goto('/')
  await openDesigns(page, { occasion: options.occasion, goto: false })
  if (options.design) await page.getByRole('button', { name: `Choose ${options.design} design` }).click()
  await page.getByRole('button', { name: 'Next: Your message →' }).click()
}

/** "Make it myself", step 1, landing on step 2 (the designs). */
export async function openDesigns(page: Page, options: { occasion?: string; goto?: boolean } = {}) {
  if (options.goto !== false) await page.goto('/')
  await page.getByRole('button', { name: /Make it myself/ }).click()
  await page.getByRole('group', { name: 'What would you like to say?' }).getByRole('button', { name: options.occasion ?? 'Birthday', exact: true }).click()
}
