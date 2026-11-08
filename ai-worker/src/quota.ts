import type { QuotaConfig } from './config'

export type Mode = 'signature' | 'creative'

/** The subset of Durable Object storage the quota rules use; an in-memory Map implements it in tests. */
export interface QuotaStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(keys: string[]): Promise<number>
  list<T>(options: { prefix: string }): Promise<Map<string, T>>
}

export type Reservation = { day: string; neurons: number }

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; error: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; error: 'daily_limit_reached' | 'budget_exhausted' }

export type QuotaStatus = { signatureRemaining: number; creativeRemaining: number; budgetRemaining: number }

type VisitorRecord = { signature: number; creative: number; lastAt: number }

const emptyVisitor: VisitorRecord = { signature: 0, creative: 0, lastAt: 0 }

/** The UTC calendar day, matching Cloudflare's 00:00 UTC reset of the free allocation. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

const spentKey = (day: string) => `spent:${day}`
const visitorKey = (day: string, visitor: string) => `visitor:${day}:${visitor}`

/**
 * Global daily Neuron budget plus per-visitor quotas. Methods are meant to run
 * inside one Durable Object, which handles one event at a time, so the
 * read-then-write sequences below can't interleave with another request.
 */
export class QuotaRules {
  private readonly storage: QuotaStorage
  private readonly config: QuotaConfig

  constructor(storage: QuotaStorage, config: QuotaConfig) {
    this.storage = storage
    this.config = config
  }

  private perVisitorLimit(mode: Mode) {
    return mode === 'signature' ? this.config.signaturePerVisitorPerDay : this.config.creativePerVisitorPerDay
  }

  private reserveFor(mode: Mode) {
    return mode === 'signature' ? this.config.textReserveNeurons : this.config.imageReserveNeurons
  }

  /**
   * Call before every AI request. `countsAsUse: false` marks the single
   * server-side retry: it still needs global budget, but it doesn't use up the
   * visitor's quota or restart their cooldown.
   */
  async reserve(visitor: string, mode: Mode, now: number, countsAsUse = true): Promise<ReserveResult> {
    const day = utcDay(now)
    const neurons = this.reserveFor(mode)
    const spent = (await this.storage.get<number>(spentKey(day))) ?? 0
    const record = (await this.storage.get<VisitorRecord>(visitorKey(day, visitor))) ?? emptyVisitor

    if (countsAsUse) {
      const sinceLast = now - record.lastAt
      const cooldownMs = this.config.cooldownSeconds * 1000
      if (record.lastAt > 0 && sinceLast < cooldownMs) {
        return { ok: false, error: 'rate_limited', retryAfterSeconds: Math.ceil((cooldownMs - sinceLast) / 1000) }
      }
      if (record[mode] >= this.perVisitorLimit(mode)) return { ok: false, error: 'daily_limit_reached' }
    }
    if (spent + neurons > this.config.dailyNeuronCap) return { ok: false, error: 'budget_exhausted' }

    await this.storage.put(spentKey(day), spent + neurons)
    if (countsAsUse) {
      await this.storage.put(visitorKey(day, visitor), { ...record, [mode]: record[mode] + 1, lastAt: now })
    }
    return { ok: true, reservation: { day, neurons } }
  }

  /**
   * Replaces a reservation's estimate with what the call actually used. Leave
   * `actualNeurons` null when usage is unknown (timeouts, provider errors),
   * so the full reservation stays counted.
   */
  async settle(reservation: Reservation, actualNeurons: number | null): Promise<void> {
    if (actualNeurons === null || !Number.isFinite(actualNeurons) || actualNeurons < 0) return
    const key = spentKey(reservation.day)
    const spent = (await this.storage.get<number>(key)) ?? 0
    await this.storage.put(key, Math.max(0, spent - reservation.neurons + Math.ceil(actualNeurons)))
  }

  async status(visitor: string, now: number): Promise<QuotaStatus> {
    const day = utcDay(now)
    const spent = (await this.storage.get<number>(spentKey(day))) ?? 0
    const record = (await this.storage.get<VisitorRecord>(visitorKey(day, visitor))) ?? emptyVisitor
    const budgetRemaining = Math.max(0, this.config.dailyNeuronCap - spent)
    const canAfford = (mode: Mode) => budgetRemaining >= this.reserveFor(mode)
    return {
      signatureRemaining: canAfford('signature') ? Math.max(0, this.config.signaturePerVisitorPerDay - record.signature) : 0,
      creativeRemaining: canAfford('creative') ? Math.max(0, this.config.creativePerVisitorPerDay - record.creative) : 0,
      budgetRemaining,
    }
  }

  /** Deletes every record from days before `now`'s UTC day, so hashed visitor keys never outlive their day. */
  async purgeOldDays(now: number): Promise<number> {
    const today = utcDay(now)
    let deleted = 0
    for (const prefix of ['spent:', 'visitor:']) {
      const entries = await this.storage.list<unknown>({ prefix })
      const stale = [...entries.keys()].filter((key) => key.slice(prefix.length, prefix.length + 10) !== today)
      // Durable Object storage deletes at most 128 keys per call.
      for (let index = 0; index < stale.length; index += 128) {
        deleted += await this.storage.delete(stale.slice(index, index + 128))
      }
    }
    return deleted
  }
}
