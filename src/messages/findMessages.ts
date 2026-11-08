import { messageLibrary, type LibraryMessage, type MessageTone } from '../data/messageLibrary'
import { getOccasion, occasionLibrary } from '../data/occasionLibrary'
import { getRecipient, recipients as allRecipients } from '../data/recipientLibrary'

export type MessageQuery = {
  /** Library recipient ids from the chosen recipient. Empty or missing means "anyone" (e.g. the Other choice). */
  recipientIds?: string[]
  occasionId?: string
  tone?: MessageTone
}

export type MessageResults = {
  messages: LibraryMessage[]
  /** The occasion the messages actually came from; differs from the request when it had none. */
  occasionId?: string
  /** True when the requested occasion had nothing suitable, so a related one was used. */
  usedRelatedOccasion: boolean
  /** True when nothing suited the chosen recipient, so messages for anyone are shown. */
  broadenedRecipient: boolean
}

/** Lower-case, accent-free, straight quotes, so "Fiancé", "fiance" and "I’m" all match as people type them. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’`´]/g, "'")
    .toLowerCase()
    .trim()
}

/** How well a message suits the chosen recipient: 3 exact, 2 same group, 1 suits anyone, 0 not suitable. */
function recipientScore(message: LibraryMessage, recipientIds: string[]): number {
  if (recipientIds.length === 0) return 1
  if (message.recipients.some((key) => recipientIds.includes(key))) return 3
  const groups = new Set<string>(recipientIds.flatMap((id) => getRecipient(id)?.group ?? []))
  if (message.recipients.some((key) => groups.has(key))) return 2
  return message.recipients.includes('anyone') ? 1 : 0
}

function rank(messages: LibraryMessage[], recipientIds: string[], tone?: MessageTone): LibraryMessage[] {
  return messages
    .map((message, index) => ({ message, index, score: recipientScore(message, recipientIds) + (tone && message.tone === tone ? 0.5 : 0) }))
    .filter(({ score }) => score >= 1)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ message }) => message)
}

/**
 * Messages for a recipient and occasion, best match first. If the occasion has
 * nothing suitable it follows `relatedTo` (e.g. Condolences → Sympathy →
 * Thinking of you). If nothing suits the recipient at all, it shows the
 * occasion's messages anyway, so there's always something to read.
 */
export function findMessages(query: MessageQuery, library: LibraryMessage[] = messageLibrary): MessageResults {
  const recipientIds = query.recipientIds ?? []
  if (!query.occasionId) {
    return { messages: rank(library, recipientIds, query.tone), usedRelatedOccasion: false, broadenedRecipient: false }
  }

  const visited = new Set<string>()
  let occasionId: string | undefined = query.occasionId
  while (occasionId && !visited.has(occasionId)) {
    visited.add(occasionId)
    const forOccasion = library.filter((message) => message.occasion === occasionId)
    const ranked = rank(forOccasion, recipientIds, query.tone)
    if (ranked.length > 0) {
      return { messages: ranked, occasionId, usedRelatedOccasion: occasionId !== query.occasionId, broadenedRecipient: false }
    }
    if (forOccasion.length > 0 && !getOccasion(occasionId)?.relatedTo) {
      return { messages: rank(forOccasion, [], query.tone), occasionId, usedRelatedOccasion: occasionId !== query.occasionId, broadenedRecipient: true }
    }
    occasionId = getOccasion(occasionId)?.relatedTo
  }
  // Nothing suited the recipient along the related chain: show the original occasion's messages for anyone.
  const original = library.filter((message) => message.occasion === query.occasionId)
  return { messages: rank(original, [], query.tone), occasionId: query.occasionId, usedRelatedOccasion: false, broadenedRecipient: original.length > 0 }
}

function searchableText(message: LibraryMessage): string {
  const occasion = getOccasion(message.occasion)
  const recipientWords = message.recipients.flatMap((key) => {
    const recipient = getRecipient(key)
    return recipient ? [recipient.label, ...(recipient.aliases ?? [])] : [key]
  })
  return normalizeText([message.text, ...message.tags, message.tone, occasion?.label ?? '', ...(occasion?.aliases ?? []), ...recipientWords].join(' '))
}

/**
 * Optional search across the whole library: message text, tags, tone,
 * occasion and recipient names. Every word typed must match somewhere, in any
 * order. Messages whose own text contains the words come first.
 */
export function searchMessages(query: string, library: LibraryMessage[] = messageLibrary): LibraryMessage[] {
  const words = normalizeText(query).split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return []
  return library
    .map((message, index) => ({ message, index, haystack: searchableText(message), text: normalizeText(message.text) }))
    .filter(({ haystack }) => words.every((word) => haystack.includes(word)))
    .map((entry) => ({ ...entry, textHits: words.filter((word) => entry.text.includes(word)).length }))
    .sort((a, b) => b.textHits - a.textHits || a.index - b.index)
    .map(({ message }) => message)
}

/**
 * "Surprise me": a random message from the list, avoiding ones already shown
 * while there are alternatives. Pass the ids shown so far as `seen`.
 */
export function surpriseMessage(messages: LibraryMessage[], seen: ReadonlySet<string> = new Set(), random: () => number = Math.random): LibraryMessage | undefined {
  if (messages.length === 0) return undefined
  const fresh = messages.filter((message) => !seen.has(message.id))
  const pool = fresh.length > 0 ? fresh : messages
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** Recipients and occasions matching a search, for "See more" pickers. */
export function searchRecipients(query: string) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return allRecipients
  return allRecipients.filter((recipient) => {
    const haystack = normalizeText([recipient.label, ...(recipient.aliases ?? [])].join(' '))
    return words.every((word) => haystack.includes(word))
  })
}

export function searchOccasions(query: string) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return occasionLibrary
  return occasionLibrary.filter((occasion) => {
    const haystack = normalizeText([occasion.label, ...(occasion.aliases ?? [])].join(' '))
    return words.every((word) => haystack.includes(word))
  })
}
