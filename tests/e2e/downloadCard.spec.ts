import { test, expect } from '@playwright/test'

const longMessage = 'Happy 89th Birthday, Lola!\nThanking God for the precious gift of your life and 89 years of His abundant blessings. May He continue to bless you with peace, good health, and strength, and shower our family with His love and grace. May your life always be a beautiful testament to His goodness and faithfulness. Wishing you a truly blessed and meaningful birthday!'

test('downloaded card includes the whole long message', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const drawn: string[] = []
    ;(window as unknown as { __drawnText: string[] }).__drawnText = drawn
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      drawn.push(text)
      return original.call(this, text, ...rest)
    }
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'To optional' }).fill('Lola Nita')
  await page.getByRole('textbox', { name: /Your message/ }).fill(longMessage)
  await page.getByRole('textbox', { name: 'From optional' }).fill('Santos Fam')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Card' }).click()
  const download = await downloadPromise
  await download.saveAs(testInfo.outputPath('card.png'))

  const drawnText = await page.evaluate(() => (window as unknown as { __drawnText: string[] }).__drawnText.join(' '))
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
  expect(normalize(drawnText)).toContain(normalize(longMessage))
})
