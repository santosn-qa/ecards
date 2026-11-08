// Node-only tests for the Message Library data and its search/filter functions.
import { expect, test } from '@playwright/test'
import { lengthOf, messageLibrary, type LibraryMessage } from '../../src/data/messageLibrary'
import { getOccasion, occasionLibrary, popularOccasions } from '../../src/data/occasionLibrary'
import { popularRecipientChoices, recipientGroups, recipients } from '../../src/data/recipientLibrary'
import { occasions as designOccasions } from '../../src/data/templates'
import { findMessages, normalizeText, searchMessages, searchOccasions, searchRecipients, surpriseMessage } from '../../src/messages/findMessages'

const recipientIds = new Set(recipients.map(({ id }) => id))
const groupIds = new Set<string>(recipientGroups.map(({ id }) => id))
const ROMANTIC_ONLY = (message: LibraryMessage) => message.recipients.every((key) => key === 'romantic' || recipients.find(({ id }) => id === key)?.group === 'romantic')
const choice = (id: string) => popularRecipientChoices.find((item) => item.id === id)!.recipientIds

test.describe('message library data', () => {
  test('has at least 100 original messages with unique ids', () => {
    expect(messageLibrary.length).toBeGreaterThanOrEqual(100)
    expect(new Set(messageLibrary.map(({ id }) => id)).size).toBe(messageLibrary.length)
  })

  test('every message is valid, readable plain text that fits the editor', () => {
    for (const message of messageLibrary) {
      const where = message.id
      expect(getOccasion(message.occasion), `${where}: occasion`).toBeTruthy()
      expect(message.recipients.length, `${where}: recipients`).toBeGreaterThan(0)
      for (const key of message.recipients) {
        expect(recipientIds.has(key) || groupIds.has(key) || key === 'anyone', `${where}: recipient ${key}`).toBe(true)
      }
      expect(message.text.length, `${where}: fits the 500-character editor`).toBeLessThanOrEqual(500)
      expect(message.text.length, `${where}: not too short`).toBeGreaterThanOrEqual(20)
      expect(message.text, `${where}: trimmed`).toBe(message.text.trim())
      expect(message.text, `${where}: no double spaces`).not.toMatch(/ {2}/)
      expect(message.text, `${where}: no placeholders or markup`).not.toMatch(/[[\]{}<>]/)
      expect(message.text, `${where}: ends a sentence`).toMatch(/[.!?]$/)
      expect(message.tags.length, `${where}: tags`).toBeGreaterThan(0)
      expect(message.language).toBe('en')
      expect(message.length).toBe(lengthOf(message.text))
    }
  })

  test('offers short, medium and long messages', () => {
    const lengths = new Set(messageLibrary.map(({ length }) => length))
    expect([...lengths].sort()).toEqual(['long', 'medium', 'short'])
  })

  test('meets the minimum coverage in the brief', () => {
    const count = (occasion: string | string[], keys?: string[]) =>
      messageLibrary.filter((message) => [occasion].flat().includes(message.occasion) && (!keys || message.recipients.some((key) => keys.includes(key)))).length
    const minimums: Array<[string, number, number]> = [
      ['Birthday – Mother', count('birthday', ['mother']), 10],
      ['Birthday – Father', count('birthday', ['father']), 10],
      ['Birthday – Friend', count('birthday', ['friend', 'best-friend', 'friends']), 10],
      ['Birthday – Husband/Wife/Partner', count('birthday', ['husband', 'wife', 'romantic']), 10],
      ['Birthday – Boss/Colleague', count('birthday', ['boss', 'coworker', 'colleague', 'professional']), 5],
      ['Thank You', count('thank-you'), 5],
      ['Congratulations', count('congratulations'), 5],
      ['Anniversary', count('anniversary'), 5],
      ["Mother's Day", count('mothers-day'), 5],
      ["Father's Day", count('fathers-day'), 5],
      ['Get Well Soon', count('get-well-soon'), 5],
      ['Encouragement', count('encouragement'), 5],
      ['I Miss You', count('i-miss-you'), 5],
      ['I Love You', count('i-love-you'), 5],
      ['Apologies', count(['im-sorry', 'forgiveness', 'making-amends', 'reconciliation']), 5],
    ]
    for (const [label, actual, minimum] of minimums) expect(actual, label).toBeGreaterThanOrEqual(minimum)
  })
})

test.describe('recipient and occasion libraries', () => {
  test('popular recipients match the brief, in order, with valid ids', () => {
    expect(popularRecipientChoices.map(({ label }) => label)).toEqual([
      'Mom', 'Dad', 'Husband / Wife', 'Boyfriend / Girlfriend', 'Son / Daughter', 'Brother / Sister',
      'Grandma / Grandpa', 'Friend', 'Best friend', 'Boss', 'Coworker', 'Teacher', 'Other',
    ])
    for (const item of popularRecipientChoices) for (const id of item.recipientIds) expect(recipientIds.has(id), id).toBe(true)
    expect(new Set(recipients.map(({ id }) => id)).size).toBe(recipients.length)
  })

  test('popular occasions match the brief, in order', () => {
    expect(popularOccasions.map(({ label }) => label)).toEqual([
      'Birthday', 'Anniversary', 'Thank you', 'Congratulations', 'I love you', 'I miss you', 'Get well soon', 'Good luck',
      'I’m sorry', 'Thinking of you', 'Mother’s Day', 'Father’s Day', 'Christmas', 'New Year', 'Just because',
    ])
  })

  test('every occasion has a unique id, an existing design set, and a related occasion that leads somewhere', () => {
    expect(new Set(occasionLibrary.map(({ id }) => id)).size).toBe(occasionLibrary.length)
    for (const occasion of occasionLibrary) {
      expect(designOccasions, occasion.id).toContain(occasion.designs)
      const chain = new Set<string>()
      let current = occasion.relatedTo
      while (current) {
        expect(getOccasion(current), `${occasion.id} → ${current}`).toBeTruthy()
        expect(chain.has(current), `${occasion.id}: related chain loops`).toBe(false)
        chain.add(current)
        current = getOccasion(current)?.relatedTo
      }
      if (!occasion.popular) expect(occasion.relatedTo, `${occasion.id} needs a related occasion`).toBeTruthy()
    }
  })

  test('“See more” search finds recipients and occasions by everyday words', () => {
    expect(searchRecipients('grandma').map(({ id }) => id)).toContain('grandmother')
    expect(searchRecipients('mum').map(({ id }) => id)).toContain('mother')
    expect(searchRecipients('Fiancée').map(({ id }) => id)).toContain('fiance')
    expect(searchOccasions('xmas').map(({ id }) => id)).toEqual(['christmas'])
    expect(searchOccasions('80th').map(({ id }) => id)).toEqual(['milestone-birthday'])
    expect(searchRecipients('')).toHaveLength(recipients.length)
  })
})

test.describe('finding messages', () => {
  test('every popular recipient and popular occasion pairing has messages to choose from', () => {
    for (const recipient of popularRecipientChoices) {
      for (const occasion of popularOccasions) {
        const results = findMessages({ recipientIds: recipient.recipientIds, occasionId: occasion.id })
        expect(results.messages.length, `${recipient.label} × ${occasion.label}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('puts messages written for that person first', () => {
    expect(findMessages({ recipientIds: choice('mom'), occasionId: 'birthday' }).messages.slice(0, 10).every(({ recipients }) => recipients.includes('mother'))).toBe(true)
    expect(findMessages({ recipientIds: choice('dad'), occasionId: 'fathers-day' }).messages[0].recipients).toContain('father')
    expect(findMessages({ recipientIds: ['wife'], occasionId: 'birthday' }).messages[0].recipients).toContain('wife')
  })

  test('never offers romantic messages to family, friends or work recipients', () => {
    for (const recipient of popularRecipientChoices.filter(({ id }) => !['husband-wife', 'boyfriend-girlfriend', 'other'].includes(id))) {
      for (const occasion of popularOccasions) {
        const romantic = findMessages({ recipientIds: recipient.recipientIds, occasionId: occasion.id }).messages.filter(ROMANTIC_ONLY)
        expect(romantic.map(({ id }) => id), `${recipient.label} × ${occasion.label}`).toEqual([])
      }
    }
  })

  test('keeps work messages professional: no family-only or casual-family wording for a boss', () => {
    const boss = findMessages({ recipientIds: choice('boss'), occasionId: 'birthday' }).messages
    expect(boss.length).toBeGreaterThan(0)
    expect(boss.every(({ recipients }) => recipients.some((key) => ['boss', 'manager', 'team-leader', 'mentor', 'professional', 'anyone'].includes(key)))).toBe(true)
    expect(boss.map(({ id }) => id)).not.toContain('birthday-mother-001')
  })

  test('falls back to a related occasion, and says so', () => {
    const condolences = findMessages({ recipientIds: [], occasionId: 'condolences' })
    expect(condolences).toMatchObject({ occasionId: 'sympathy', usedRelatedOccasion: true })
    expect(condolences.messages.length).toBeGreaterThan(0)
    const welcome = findMessages({ occasionId: 'welcome' })
    expect(welcome).toMatchObject({ occasionId: 'just-because', usedRelatedOccasion: true })
    expect(findMessages({ occasionId: 'birthday' }).usedRelatedOccasion).toBe(false)
  })

  test('browses without a recipient (“Other”) and without an occasion', () => {
    expect(findMessages({ recipientIds: [], occasionId: 'birthday' }).messages.length).toBe(messageLibrary.filter(({ occasion }) => occasion === 'birthday').length)
    expect(findMessages({}).messages).toHaveLength(messageLibrary.length)
  })

  test('an optional tone only reorders, never hides messages', () => {
    const plain = findMessages({ recipientIds: choice('friend'), occasionId: 'birthday' }).messages
    const funny = findMessages({ recipientIds: choice('friend'), occasionId: 'birthday', tone: 'funny' }).messages
    expect(funny.length).toBe(plain.length)
    expect(funny[0].tone).toBe('funny')
  })
})

test.describe('search and surprise', () => {
  test('matches message text, tags, recipients and occasions, ignoring case, accents and quote style', () => {
    expect(searchMessages('grandma cookies').map(({ id }) => id)).toEqual(['birthday-grandparent-001'])
    expect(searchMessages('TV remote').map(({ id }) => id)).toEqual(['birthday-partner-009'])
    expect(searchMessages('I’m sorry').length).toBeGreaterThan(0)
    expect(searchMessages('cafe').map(({ id }) => id)).toContain('i-miss-you-anyone-003')
    expect(searchMessages('xmas').every(({ occasion }) => occasion === 'christmas')).toBe(true)
    expect(searchMessages('fiancée').length).toBeGreaterThan(0)
    expect(normalizeText('  Fiancé’s  ')).toBe("fiance's")
  })

  test('returns nothing for empty or unmatched searches', () => {
    expect(searchMessages('')).toEqual([])
    expect(searchMessages('   ')).toEqual([])
    expect(searchMessages('zebra spaceship')).toEqual([])
  })

  test('“Surprise me” avoids repeats until every option has been shown', () => {
    const options = findMessages({ recipientIds: choice('mom'), occasionId: 'birthday' }).messages
    const seen = new Set<string>()
    let seed = 0.37
    const random = () => (seed = (seed * 9301 + 0.49297) % 1)
    for (let i = 0; i < options.length; i++) {
      const pick = surpriseMessage(options, seen, random)!
      expect(seen.has(pick.id)).toBe(false)
      seen.add(pick.id)
    }
    expect(seen.size).toBe(options.length)
    expect(surpriseMessage(options, seen, random)).toBeTruthy()
    expect(surpriseMessage([], seen)).toBeUndefined()
  })
})
