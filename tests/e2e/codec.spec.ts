import { expect, test } from '@playwright/test'
import { encodeCard, decodeCardHash } from '../../src/card/codec'
import type { CardDraft } from '../../src/data/templates'

const sampleDraft: CardDraft = {
  to: 'Mom',
  message: 'Happy birthday! Hope your day is filled with joy and cake.',
  from: 'Alex',
  messageFont: 'dancing-script',
}

test.describe('compact (v2) card codec pure logic', () => {
  test('round-trips a full draft through encode and decode', async () => {
    const payload = await encodeCard(sampleDraft, 'birthday-party-01')
    const result = await decodeCardHash(`#/card/v2/${payload}`)
    expect(result?.ok).toBe(true)
    if (result?.ok) {
      expect(result.card.template).toBe('birthday-party-01')
      expect(result.card.to).toBe('Mom')
      expect(result.card.message).toBe(sampleDraft.message)
      expect(result.card.from).toBe('Alex')
      expect(result.card.messageFont).toBe('dancing-script')
    }
  })

  test('round-trips a draft with no messageFont, falling back to the template default', async () => {
    const payload = await encodeCard({ to: '', message: 'Hi', from: '' }, 'love-letter-01')
    const result = await decodeCardHash(`#/card/v2/${payload}`)
    expect(result?.ok).toBe(true)
    if (result?.ok) {
      expect(result.card.messageFont).toBe('satisfy')
    }
  })

  test('produces a shorter payload than the legacy verbose format for a typical message', async () => {
    const compactPayload = await encodeCard(sampleDraft, 'birthday-party-01')
    const legacyJson = JSON.stringify({
      v: 1,
      template: 'birthday-party-01',
      to: sampleDraft.to,
      message: sampleDraft.message,
      from: sampleDraft.from,
      messageFont: sampleDraft.messageFont,
    })
    const legacyPayload = btoa(legacyJson)
    expect(compactPayload.length).toBeLessThan(legacyPayload.length)
  })

  test('rejects a corrupted v2 payload as invalid instead of throwing', async () => {
    const result = await decodeCardHash('#/card/v2/not-a-valid-payload')
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  test('rejects an out-of-range template code as missing-template', async () => {
    const payload = await encodeCard(sampleDraft, 'not-a-real-template-id')
    const result = await decodeCardHash(`#/card/v2/${payload}`)
    expect(result).toEqual({ ok: false, reason: 'missing-template' })
  })
})
