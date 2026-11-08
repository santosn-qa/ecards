import { DurableObject } from 'cloudflare:workers'
import { parseConfig, type RawConfigEnv } from './config'
import { QuotaRules, type Mode, type QuotaStatus, type QuotaStorage, type Reservation, type ReserveResult } from './quota'

const DAY_MS = 24 * 60 * 60 * 1000

/** Milliseconds until shortly after the next 00:00 UTC. */
function nextPurgeAt(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS + DAY_MS + 60_000
}

/**
 * The single, global quota counter. Every Worker instance addresses the same
 * object by a fixed name, and a Durable Object handles one event at a time, so
 * reservations can't race each other the way KV writes can. It's a thin
 * adapter: the rules live in QuotaRules, which is tested in Node.
 */
export class QuotaGuard extends DurableObject<RawConfigEnv> {
  private rules(): QuotaRules {
    const storage: QuotaStorage = {
      get: (key) => this.ctx.storage.get(key),
      put: (key, value) => this.ctx.storage.put(key, value),
      delete: (keys) => this.ctx.storage.delete(keys),
      list: (options) => this.ctx.storage.list(options),
    }
    return new QuotaRules(storage, parseConfig(this.env).quota)
  }

  private async ensurePurgeAlarm(now: number) {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(nextPurgeAt(now))
  }

  async reserve(visitor: string, mode: Mode, now: number, countsAsUse = true): Promise<ReserveResult> {
    await this.ensurePurgeAlarm(now)
    return this.rules().reserve(visitor, mode, now, countsAsUse)
  }

  async settle(reservation: Reservation, actualNeurons: number | null): Promise<void> {
    return this.rules().settle(reservation, actualNeurons)
  }

  async status(visitor: string, now: number): Promise<QuotaStatus> {
    return this.rules().status(visitor, now)
  }

  async alarm(): Promise<void> {
    const now = Date.now()
    await this.rules().purgeOldDays(now)
    await this.ctx.storage.setAlarm(nextPurgeAt(now))
  }
}
