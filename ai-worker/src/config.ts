/** Raw string vars/secrets as Cloudflare provides them (see wrangler.toml). */
export type RawConfigEnv = {
  ALLOWED_ORIGINS?: string
  TURNSTILE_EXPECTED_HOSTNAMES?: string
  AI_ENABLED?: string
  DAILY_NEURON_ALLOWANCE?: string
  BUDGET_FRACTION?: string
  SIGNATURE_PER_VISITOR_PER_DAY?: string
  CREATIVE_PER_VISITOR_PER_DAY?: string
  VISITOR_COOLDOWN_SECONDS?: string
  TEXT_RESERVE_NEURONS?: string
  IMAGE_RESERVE_NEURONS?: string
  CREATIVE_BUDGET_FRACTION?: string
  IP_HASH_SECRET?: string
  TURNSTILE_SECRET_KEY?: string
}

export type QuotaConfig = {
  /** Neurons per UTC day this Worker may spend: allowance x fraction, floored. */
  dailyNeuronCap: number
  /** The part of dailyNeuronCap images may use, so illustrations can never starve text messages. */
  creativeNeuronCap: number
  signaturePerVisitorPerDay: number
  creativePerVisitorPerDay: number
  cooldownSeconds: number
  textReserveNeurons: number
  imageReserveNeurons: number
}

export type AppConfig = {
  allowedOrigins: Set<string>
  expectedTurnstileHostnames: Set<string>
  aiEnabled: boolean
  ipHashSecret: string
  turnstileSecretKey: string
  quota: QuotaConfig
}

function list(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map((item) => item.trim()).filter(Boolean))
}

/** Parses a non-negative number; anything missing or malformed becomes `fallback`. */
function number(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

/**
 * Turns Worker vars into typed config. Malformed numbers fall back to the
 * conservative defaults documented in the design spec. The budget fraction is
 * clamped to at most 1, so a typo can never authorise spending past the free
 * allocation.
 */
export function parseConfig(env: RawConfigEnv): AppConfig {
  const allowance = number(env.DAILY_NEURON_ALLOWANCE, 10000)
  const fraction = Math.min(number(env.BUDGET_FRACTION, 0.8), 1)
  return {
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    expectedTurnstileHostnames: list(env.TURNSTILE_EXPECTED_HOSTNAMES),
    aiEnabled: env.AI_ENABLED === 'true',
    ipHashSecret: env.IP_HASH_SECRET ?? '',
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY ?? '',
    quota: {
      dailyNeuronCap: Math.floor(allowance * fraction),
      creativeNeuronCap: Math.floor(allowance * fraction * Math.min(number(env.CREATIVE_BUDGET_FRACTION, 0.5), 1)),
      signaturePerVisitorPerDay: Math.floor(number(env.SIGNATURE_PER_VISITOR_PER_DAY, 3)),
      creativePerVisitorPerDay: Math.floor(number(env.CREATIVE_PER_VISITOR_PER_DAY, 1)),
      cooldownSeconds: number(env.VISITOR_COOLDOWN_SECONDS, 20),
      textReserveNeurons: number(env.TEXT_RESERVE_NEURONS, 80),
      imageReserveNeurons: number(env.IMAGE_RESERVE_NEURONS, 180),
    },
  }
}
