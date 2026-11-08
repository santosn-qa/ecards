import type { AppConfig } from './config'
import { pickMessageFont, pickTemplateId } from './designPicker'
import { buildIllustrationPrompt, validateIllustrationOutput, validateIllustrationRequest } from './image'
import { imageNeurons, textNeurons } from './neurons'
import { buildCardTextPrompt, cardTextJsonSchema } from './prompt'
import type { ImageGeneration, ImageProvider, TextGeneration, TextProvider } from './providers'
import type { Mode, QuotaStatus, Reservation, ReserveResult } from './quota'
import type { TurnstileOutcome } from './turnstile'
import { validateGeneratedCardText, validateMessageRequest, type MessageRequest } from './validate'

export const MAX_BODY_BYTES = 8 * 1024
export const TEXT_TIMEOUT_MS = 20_000
export const IMAGE_TIMEOUT_MS = 40_000
/** One original attempt plus at most one controlled retry per user action. */
export const MAX_TEXT_ATTEMPTS = 2
export const MAX_IMAGE_ATTEMPTS = 2

/** The quota operations the handler needs; in production these are RPC calls to the QuotaGuard Durable Object. */
export interface QuotaClient {
  reserve(visitor: string, mode: Mode, now: number, countsAsUse?: boolean): Promise<ReserveResult>
  settle(reservation: Reservation, actualNeurons: number | null): Promise<void>
  status(visitor: string, now: number): Promise<QuotaStatus>
}

export type HandlerDeps = {
  config: AppConfig
  quota: QuotaClient
  textProvider: TextProvider
  imageProvider: ImageProvider
  verifyTurnstile: (token: string, remoteIp: string | undefined) => Promise<TurnstileOutcome>
  hashVisitor: (ip: string) => Promise<string>
  now?: () => number
  textTimeoutMs?: number
  imageTimeoutMs?: number
}

export type ErrorCode =
  | 'invalid_request'
  | 'forbidden_origin'
  | 'verification_failed'
  | 'verification_unavailable'
  | 'rate_limited'
  | 'daily_limit_reached'
  | 'budget_exhausted'
  | 'ai_disabled'
  | 'generation_failed'
  | 'not_found'

const errorStatus: Record<ErrorCode, number> = {
  invalid_request: 400,
  forbidden_origin: 403,
  verification_failed: 403,
  verification_unavailable: 503,
  rate_limited: 429,
  daily_limit_reached: 429,
  budget_exhausted: 503,
  ai_disabled: 503,
  generation_failed: 502,
  not_found: 404,
}

function baseHeaders(origin: string | null, config: AppConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  }
  if (origin && config.allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function error(code: ErrorCode, headers: Record<string, string>, extra: Record<string, unknown> = {}): Response {
  return json({ error: code, ...extra }, errorStatus[code], headers)
}

async function readJsonBody(request: Request): Promise<unknown | undefined> {
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > MAX_BODY_BYTES) return undefined
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return undefined
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Runs a provider call, giving up after `timeoutMs` even if the provider ignores the abort signal. */
async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('generation timed out'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([run(controller.signal), timeout])
  } finally {
    clearTimeout(timer)
  }
}

function generateWithTimeout(provider: TextProvider, request: MessageRequest, timeoutMs: number): Promise<TextGeneration> {
  return withTimeout((signal) => provider.generate(buildCardTextPrompt(request), cardTextJsonSchema(request), signal), timeoutMs)
}

async function handleGenerateMessage(request: Request, deps: HandlerDeps, headers: Record<string, string>): Promise<Response> {
  const { config } = deps
  const now = deps.now ?? Date.now
  if (!config.aiEnabled) return error('ai_disabled', headers)
  if (!config.ipHashSecret) {
    console.error('generate/message refused: IP_HASH_SECRET is not configured')
    return error('ai_disabled', headers)
  }

  const body = await readJsonBody(request)
  if (body === undefined) return error('invalid_request', headers)
  const validation = validateMessageRequest(body)
  if (!validation.ok) return error('invalid_request', headers)
  const input = validation.value

  const ip = request.headers.get('CF-Connecting-IP') ?? undefined
  const turnstile = await deps.verifyTurnstile(input.turnstileToken, ip)
  if (!turnstile.ok) {
    return error(turnstile.reason === 'unavailable' ? 'verification_unavailable' : 'verification_failed', headers)
  }

  // The user's own words are kept verbatim and need no AI call: only the
  // design is chosen, deterministically, at no Neuron cost.
  if (input.personalMessage) {
    return json(
      {
        message: input.personalMessage,
        templateId: pickTemplateId(input.occasion, input.style),
        messageFont: pickMessageFont(input.tone),
        source: 'user',
      },
      200,
      headers,
    )
  }

  const visitor = await deps.hashVisitor(ip ?? 'unknown')
  let reserved = await deps.quota.reserve(visitor, 'signature', now())
  if (!reserved.ok) {
    return reserved.error === 'rate_limited'
      ? error('rate_limited', headers, { retryAfterSeconds: reserved.retryAfterSeconds })
      : error(reserved.error, headers)
  }

  for (let attempt = 1; attempt <= MAX_TEXT_ATTEMPTS; attempt++) {
    let generation: TextGeneration | undefined
    try {
      generation = await generateWithTimeout(deps.textProvider, input, deps.textTimeoutMs ?? TEXT_TIMEOUT_MS)
    } catch (err) {
      console.error('generate/message provider error', { attempt, kind: err instanceof Error ? err.name : 'unknown' })
    }

    const actual = generation?.usage ? (textNeurons(generation.model, generation.usage) ?? null) : null
    await deps.quota.settle(reserved.reservation, actual)
    // Numbers only (never content), so real Neuron cost can be checked against the reserve.
    console.log('generate/message usage', {
      attempt,
      promptTokens: generation?.usage?.promptTokens ?? null,
      completionTokens: generation?.usage?.completionTokens ?? null,
      neurons: actual,
      reserved: reserved.reservation.neurons,
    })

    if (generation) {
      const output = validateGeneratedCardText(generation.raw, input.occasion)
      if (output.ok) {
        return json(
          {
            message: output.value.message,
            templateId: output.value.templateId ?? pickTemplateId(input.occasion, input.style),
            messageFont: output.value.messageFont ?? pickMessageFont(input.tone),
            source: 'ai',
          },
          200,
          headers,
        )
      }
      console.error('generate/message rejected model output', { attempt, reason: output.reason })
    }

    if (attempt < MAX_TEXT_ATTEMPTS) {
      // The retry needs global budget but doesn't use up the visitor's quota.
      const retry = await deps.quota.reserve(visitor, 'signature', now(), false)
      if (!retry.ok) break
      reserved = retry
    }
  }
  return error('generation_failed', headers)
}

async function handleGenerateIllustration(request: Request, deps: HandlerDeps, headers: Record<string, string>): Promise<Response> {
  const { config } = deps
  const now = deps.now ?? Date.now
  if (!config.aiEnabled) return error('ai_disabled', headers)
  if (!config.ipHashSecret) {
    console.error('generate/illustration refused: IP_HASH_SECRET is not configured')
    return error('ai_disabled', headers)
  }

  const body = await readJsonBody(request)
  if (body === undefined) return error('invalid_request', headers)
  const validation = validateIllustrationRequest(body)
  if (!validation.ok) return error('invalid_request', headers)
  const input = validation.value

  const ip = request.headers.get('CF-Connecting-IP') ?? undefined
  const turnstile = await deps.verifyTurnstile(input.turnstileToken, ip)
  if (!turnstile.ok) {
    return error(turnstile.reason === 'unavailable' ? 'verification_unavailable' : 'verification_failed', headers)
  }

  const visitor = await deps.hashVisitor(ip ?? 'unknown')
  let reserved = await deps.quota.reserve(visitor, 'creative', now())
  if (!reserved.ok) {
    return reserved.error === 'rate_limited'
      ? error('rate_limited', headers, { retryAfterSeconds: reserved.retryAfterSeconds })
      : error(reserved.error, headers)
  }

  const prompt = buildIllustrationPrompt(input)
  for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
    let generation: ImageGeneration | undefined
    try {
      generation = await withTimeout((signal) => deps.imageProvider.generate(prompt, signal), deps.imageTimeoutMs ?? IMAGE_TIMEOUT_MS)
    } catch (err) {
      console.error('generate/illustration provider error', { attempt, kind: err instanceof Error ? err.name : 'unknown' })
    }

    const output = generation ? validateIllustrationOutput(generation.raw) : undefined
    // Prefer the Neurons Workers AI reported; otherwise price the image we actually got.
    const actual = generation?.reportedNeurons !== undefined
      ? Math.ceil(generation.reportedNeurons)
      : output?.ok ? imageNeurons(output.value.width, output.value.height, generation?.steps ?? 0) : null
    await deps.quota.settle(reserved.reservation, actual)
    console.log('generate/illustration usage', { attempt, neurons: actual, reserved: reserved.reservation.neurons, bytes: output?.ok ? output.value.bytes : null })

    if (output?.ok) {
      return json({ image: output.value.base64, mimeType: 'image/jpeg', width: output.value.width, height: output.value.height }, 200, headers)
    }
    if (output && !output.ok) console.error('generate/illustration rejected model output', { attempt, reason: output.reason })

    if (attempt < MAX_IMAGE_ATTEMPTS) {
      const retry = await deps.quota.reserve(visitor, 'creative', now(), false)
      if (!retry.ok) break
      reserved = retry
    }
  }
  return error('generation_failed', headers)
}

async function handleStatus(request: Request, deps: HandlerDeps, headers: Record<string, string>): Promise<Response> {
  const { config } = deps
  if (!config.aiEnabled || !config.ipHashSecret) {
    return json({ enabled: false, signatureRemaining: 0, creativeRemaining: 0 }, 200, headers)
  }
  const visitor = await deps.hashVisitor(request.headers.get('CF-Connecting-IP') ?? 'unknown')
  const status = await deps.quota.status(visitor, (deps.now ?? Date.now)())
  return json(
    {
      enabled: true,
      signatureRemaining: status.signatureRemaining,
      creativeRemaining: status.creativeRemaining,
    },
    200,
    headers,
  )
}

export async function handleRequest(request: Request, deps: HandlerDeps): Promise<Response> {
  const origin = request.headers.get('Origin')
  const headers = baseHeaders(origin, deps.config)
  const { pathname } = new URL(request.url)

  // Browsers always send Origin on these cross-origin calls. Non-browser
  // clients can forge it, which is why Turnstile and the quota are the real gates.
  if (!origin || !deps.config.allowedOrigins.has(origin)) return error('forbidden_origin', headers)

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      },
    })
  }

  try {
    if (request.method === 'GET' && pathname === '/v1/status') return await handleStatus(request, deps, headers)
    if (request.method === 'POST' && pathname === '/v1/generate/message') return await handleGenerateMessage(request, deps, headers)
    if (request.method === 'POST' && pathname === '/v1/generate/illustration') return await handleGenerateIllustration(request, deps, headers)
  } catch (err) {
    console.error('request failed', { path: pathname, kind: err instanceof Error ? err.name : 'unknown' })
    return error('generation_failed', headers)
  }
  return error('not_found', headers)
}
