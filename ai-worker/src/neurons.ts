// Published Workers AI rates, from https://developers.cloudflare.com/workers-ai/platform/pricing/
// (page last updated 2026-10-20). Update this table, not call sites, when Cloudflare changes them.
// Workers AI also reports `usage.neurons` per call; callers prefer that figure when present.
export const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
export const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell'
export const IMAGE_STEPS = 4

const textRates: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  [TEXT_MODEL]: { inputPerMillion: 26668, outputPerMillion: 204805 },
}

export type TokenUsage = {
  promptTokens: number
  completionTokens: number
  /** The Neuron figure Workers AI reported for the call, when it reported one. */
  reportedNeurons?: number
}

/** Neurons consumed by one text call, rounded up. Returns undefined for a model with no known rate. */
export function textNeurons(model: string, usage: TokenUsage): number | undefined {
  if (usage.reportedNeurons !== undefined) return Math.ceil(usage.reportedNeurons)
  const rate = textRates[model]
  if (!rate) return undefined
  return Math.ceil(
    (usage.promptTokens * rate.inputPerMillion + usage.completionTokens * rate.outputPerMillion) / 1_000_000,
  )
}

/**
 * flux-1-schnell: 4.8 Neurons per 512x512 tile, plus 9.6 per step *for each
 * tile*. A 1024x1024 image at 4 steps is 4 x (4.8 + 4 x 9.6) = 172.8, which
 * matches the `usage.neurons` Workers AI reported in a real call (2026-11-08).
 */
export function imageNeurons(width: number, height: number, steps: number): number {
  const tiles = Math.ceil(width / 512) * Math.ceil(height / 512)
  return Math.ceil(tiles * (4.8 + 9.6 * steps))
}
