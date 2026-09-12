import { expect, test } from '@playwright/test'
import {
  SUPPORT_DISMISS_STORAGE_KEY,
  readDismissedAt,
  recordDismissal,
  shouldShowSupportPrompt,
} from '../../src/support/supportPrompt'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

test.describe('supportPrompt pure logic', () => {
  test('shows the prompt when the feature is enabled and never dismissed', () => {
    expect(shouldShowSupportPrompt(Date.now(), null, true)).toBe(true)
  })

  test('never shows the prompt when the feature is disabled, regardless of dismissal state', () => {
    expect(shouldShowSupportPrompt(Date.now(), null, false)).toBe(false)
  })

  test('suppresses the prompt immediately after a dismissal', () => {
    const now = Date.now()
    expect(shouldShowSupportPrompt(now, now, true)).toBe(false)
  })

  test('stays suppressed just before the 7-day window elapses', () => {
    const now = Date.now()
    const dismissedAt = now - (7 * ONE_DAY_MS - 1000)
    expect(shouldShowSupportPrompt(now, dismissedAt, true)).toBe(false)
  })

  test('shows the prompt again once 7 days have elapsed', () => {
    const now = Date.now()
    const dismissedAt = now - 7 * ONE_DAY_MS
    expect(shouldShowSupportPrompt(now, dismissedAt, true)).toBe(true)
  })

  test('readDismissedAt returns null and does not throw when storage is unavailable', () => {
    expect(() => readDismissedAt()).not.toThrow()
    expect(readDismissedAt()).toBeNull()
  })

  test('recordDismissal does not throw when storage is unavailable', () => {
    expect(() => recordDismissal(Date.now())).not.toThrow()
  })

  test('exports the storage key as a stable constant', () => {
    expect(SUPPORT_DISMISS_STORAGE_KEY).toBe('littleHelloSupportDismissedAt')
  })
})
