// Published Workers AI rates, from https://developers.cloudflare.com/workers-ai/platform/pricing/
// (page last updated 2026-10-20). Update this table, not call sites, when Cloudflare changes them.
export const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

const textRates: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  [TEXT_MODEL]: { inputPerMillion: 26668, outputPerMillion: 204805 },
}

export type TokenUsage = { promptTokens: number; completionTokens: number }

/** Neurons consumed by one text call, rounded up. Returns undefined for a model with no known rate. */
export function textNeurons(model: string, usage: TokenUsage): number | undefined {
  const rate = textRates[model]
  if (!rate) return undefined
  return Math.ceil(
    (usage.promptTokens * rate.inputPerMillion + usage.completionTokens * rate.outputPerMillion) / 1_000_000,
  )
}
