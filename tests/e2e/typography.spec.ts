import { expect, test } from '@playwright/test'
import { messageFonts } from '../../src/data/typography'

test.describe('message font data', () => {
  test('every font has a unique category label', () => {
    const categories = messageFonts.map((font) => font.category)
    expect(new Set(categories).size).toBe(categories.length)
  })
})
