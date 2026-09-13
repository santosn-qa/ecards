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
