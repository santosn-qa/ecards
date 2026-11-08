// Node-only tests for ai-worker's pure logic (no browser, no Cloudflare, no real AI).
import { expect, test } from '@playwright/test'
import { parseConfig, type AppConfig } from '../../ai-worker/src/config'
import { pickMessageFont, pickTemplateId } from '../../ai-worker/src/designPicker'
import { handleRequest, MAX_BODY_BYTES, type HandlerDeps } from '../../ai-worker/src/handler'
import { textNeurons, TEXT_MODEL } from '../../ai-worker/src/neurons'
import { buildCardTextPrompt } from '../../ai-worker/src/prompt'
import type { TextGeneration, TextProvider } from '../../ai-worker/src/providers'
import { QuotaRules, utcDay, type QuotaStorage } from '../../ai-worker/src/quota'
import { SITEVERIFY_URL, verifyTurnstile } from '../../ai-worker/src/turnstile'
import { validateGeneratedCardText, validateMessageRequest } from '../../ai-worker/src/validate'
import { cardTemplates } from '../../src/data/templates'

const ORIGIN = 'https://little-hello.ns-apps.workers.dev'
const GOOD_MESSAGE = 'Another trip around the sun looks good on you. I hope today is full of laughter, cake and the people you love most.'
const NOON = Date.UTC(2026, 10, 8, 12, 0, 0)
/** The default per-call text reserve, read from config so tuning it doesn't break these tests. */
const TEXT_RESERVE = parseConfig({}).quota.textReserveNeurons

function memoryStorage(): QuotaStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    async get<T>(key: string) { return data.get(key) as T | undefined },
    async put<T>(key: string, value: T) { data.set(key, structuredClone(value)) },
    async delete(keys: string[]) { let n = 0; for (const key of keys) if (data.delete(key)) n++; return n },
    async list<T>({ prefix }: { prefix: string }) {
      return new Map([...data].filter(([key]) => key.startsWith(prefix))) as Map<string, T>
    },
  }
}

function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return parseConfig({
    ALLOWED_ORIGINS: ORIGIN,
    AI_ENABLED: 'true',
    IP_HASH_SECRET: 'test-secret',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    ...overrides,
  })
}

const validBody = {
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  occasion: 'Birthday',
  recipient: 'friend',
  tone: 'playful',
  style: 'whimsical',
}

function scriptedProvider(outputs: Array<TextGeneration | Error | 'hang'>) {
  const calls: unknown[] = []
  const provider: TextProvider = {
    async generate(messages) {
      calls.push(messages)
      const next = outputs[Math.min(calls.length - 1, outputs.length - 1)]
      if (next === 'hang') return new Promise<TextGeneration>(() => {})
      if (next instanceof Error) throw next
      return next
    },
  }
  return { provider, calls }
}

const aiOutput = (raw: unknown): TextGeneration => ({ raw, model: TEXT_MODEL, usage: { promptTokens: 600, completionTokens: 120 } })

function makeDeps(options: {
  provider?: TextProvider
  config?: AppConfig
  turnstile?: HandlerDeps['verifyTurnstile']
  storage?: ReturnType<typeof memoryStorage>
  now?: () => number
} = {}) {
  const config = options.config ?? testConfig()
  const storage = options.storage ?? memoryStorage()
  const rules = new QuotaRules(storage, config.quota)
  let turnstileCalls = 0
  const deps: HandlerDeps = {
    config,
    quota: rules,
    textProvider: options.provider ?? scriptedProvider([aiOutput({ message: GOOD_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat' })]).provider,
    verifyTurnstile: options.turnstile ?? (async () => { turnstileCalls++; return { ok: true } }),
    hashVisitor: async (ip) => `visitor-${ip}`,
    now: options.now ?? (() => NOON),
    textTimeoutMs: 50,
  }
  return { deps, storage, rules, turnstileCalls: () => turnstileCalls }
}

function post(body: unknown, init: { origin?: string | null; contentType?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': init.contentType ?? 'application/json', 'CF-Connecting-IP': init.ip ?? '203.0.113.7' }
  if (init.origin !== null) headers.Origin = init.origin ?? ORIGIN
  return new Request('https://ai.example/v1/generate/message', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

test.describe('config', () => {
  test('fails closed: AI is off unless AI_ENABLED is exactly "true"', () => {
    expect(parseConfig({}).aiEnabled).toBe(false)
    expect(parseConfig({ AI_ENABLED: 'TRUE' }).aiEnabled).toBe(false)
    expect(parseConfig({ AI_ENABLED: 'true' }).aiEnabled).toBe(true)
  })

  test('caps the budget at 80% of the allowance by default and never above 100%', () => {
    expect(parseConfig({}).quota.dailyNeuronCap).toBe(8000)
    expect(parseConfig({ BUDGET_FRACTION: '5' }).quota.dailyNeuronCap).toBe(10000)
    expect(parseConfig({ BUDGET_FRACTION: 'oops', DAILY_NEURON_ALLOWANCE: '-3' }).quota.dailyNeuronCap).toBe(8000)
  })
})

test.describe('request validation', () => {
  test('accepts a minimal valid request and trims optional text', () => {
    const result = validateMessageRequest({ ...validBody, personalMessage: '  Hi there  ' })
    expect(result).toEqual({ ok: true, value: { ...validBody, personalMessage: 'Hi there', extraInstructions: '' } })
  })

  for (const [field, value] of [
    ['occasion', 'Anniversary'],
    ['recipient', 'boss'],
    ['tone', 'sarcastic'],
    ['style', 'photorealistic'],
    ['turnstileToken', ''],
    ['turnstileToken', 'x'.repeat(2049)],
  ] as const) {
    test(`rejects unsupported ${field}: ${String(value).slice(0, 20)}`, () => {
      expect(validateMessageRequest({ ...validBody, [field]: value }).ok).toBe(false)
    })
  }

  test('rejects over-long or control-character free text, and non-object bodies', () => {
    expect(validateMessageRequest({ ...validBody, personalMessage: 'a'.repeat(501) }).ok).toBe(false)
    expect(validateMessageRequest({ ...validBody, extraInstructions: 'a'.repeat(201) }).ok).toBe(false)
    expect(validateMessageRequest({ ...validBody, extraInstructions: 'bad\u0000byte' }).ok).toBe(false)
    expect(validateMessageRequest({ ...validBody, personalMessage: 42 }).ok).toBe(false)
    expect(validateMessageRequest([validBody]).ok).toBe(false)
    expect(validateMessageRequest(null).ok).toBe(false)
  })

  test('allows emojis, accents and newlines in a personal message', () => {
    expect(validateMessageRequest({ ...validBody, personalMessage: 'Joyeux anniversaire, Zoë! 🎂\nLove you' }).ok).toBe(true)
  })
})

test.describe('AI output validation', () => {
  test('accepts an object, a JSON string, or a fenced JSON string', () => {
    const output = { message: GOOD_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat' }
    for (const raw of [output, JSON.stringify(output), '```json\n' + JSON.stringify(output) + '\n```']) {
      expect(validateGeneratedCardText(raw, 'Birthday')).toEqual({ ok: true, value: output })
    }
  })

  test('drops (rather than fails on) a template from another occasion or an unknown font', () => {
    const result = validateGeneratedCardText({ message: GOOD_MESSAGE, templateId: 'love-letter-01', messageFont: 'comic-sans' }, 'Birthday')
    expect(result).toEqual({ ok: true, value: { message: GOOD_MESSAGE, templateId: undefined, messageFont: undefined } })
  })

  test('collapses whitespace and removes quotes wrapping the whole message', () => {
    const result = validateGeneratedCardText({ message: `  “${GOOD_MESSAGE.replace('. ', '.\n\n')}”  ` }, 'Birthday')
    expect(result.ok && result.value.message).toBe(GOOD_MESSAGE)
  })

  test('adds a full stop when the model leaves the last sentence unfinished, and keeps existing end punctuation', () => {
    const unfinished = validateGeneratedCardText({ message: 'Hope your day is as bright as you are, filled with laughter and cake' }, 'Birthday')
    expect(unfinished.ok && unfinished.value.message).toBe('Hope your day is as bright as you are, filled with laughter and cake.')
    for (const ending of ['!', '?', '.', '…']) {
      const result = validateGeneratedCardText({ message: `Hope your day is as bright as you are, filled with cake${ending}` }, 'Birthday')
      expect(result.ok && result.value.message.endsWith(`cake${ending}`)).toBe(true)
    }
  })

  const rejected: Array<[string, unknown]> = [
    ['invalid JSON', '{"message": "unterminated'],
    ['a JSON array', '[1,2]'],
    ['a missing message', { templateId: 'birthday-party-01' }],
    ['a non-string message', { message: 12 }],
    ['a too-short message', { message: 'Happy birthday!' }],
    ['a too-long message', { message: 'Happy day! '.repeat(60) }],
    ['HTML', { message: `${GOOD_MESSAGE} <script>alert(1)</script>` }],
    ['an image tag', { message: `<img src=x onerror=alert(1)> ${GOOD_MESSAGE}` }],
    ['a link', { message: `${GOOD_MESSAGE} Visit https://example.com` }],
    ['a bare domain', { message: `${GOOD_MESSAGE} See example.com for more.` }],
    ['markdown bold', { message: `**Happy birthday!** ${GOOD_MESSAGE}` }],
    ['a placeholder', { message: `Dear [Name], ${GOOD_MESSAGE}` }],
    ['a template variable', { message: `Hi {recipient}, ${GOOD_MESSAGE}` }],
    ['assistant preamble', { message: `Sure! ${GOOD_MESSAGE}` }],
    ['an AI disclaimer', { message: `As an AI, I think ${GOOD_MESSAGE}` }],
    ['a refusal', { message: 'I cannot help with that request, but I hope you have a lovely day anyway.' }],
    ['control characters', { message: `${GOOD_MESSAGE}\u0007` }],
  ]
  for (const [label, raw] of rejected) {
    test(`rejects ${label}`, () => {
      expect(validateGeneratedCardText(raw, 'Birthday').ok).toBe(false)
    })
  }

  test('does not mistake ordinary phrasing for a refusal', () => {
    expect(validateGeneratedCardText({ message: 'I cannot wait to celebrate with you. Happy birthday, and here is to your best year yet!' }, 'Birthday').ok).toBe(true)
  })
})

test.describe('design picker and prompt', () => {
  test('always returns a template for the requested occasion', () => {
    for (const template of cardTemplates) {
      for (const style of ['watercolor', 'minimalist', 'pastel', 'hand-drawn', 'floral', 'whimsical', 'elegant'] as const) {
        const picked = cardTemplates.find(({ id }) => id === pickTemplateId(template.occasion, style))
        expect(picked?.occasion).toBe(template.occasion)
      }
    }
    expect(pickMessageFont('romantic')).toBe('dancing-script')
  })

  test('never includes To/From names and fences user preferences', () => {
    const messages = buildCardTextPrompt({ ...validBody, occasion: 'Birthday', recipient: 'friend', tone: 'playful', style: 'whimsical', personalMessage: '', extraInstructions: 'mention <b>pizza</b>' })
    const text = messages.map(({ content }) => content).join('\n')
    expect(text).toContain('<preferences>mention bpizza/b</preferences>')
    expect(text).not.toMatch(/\bTo:|\bFrom:/)
    expect(text).toContain('birthday-party-01')
    expect(text).not.toContain('love-letter-01')
  })

  test('computes Neurons from token usage with the published 70B rates', () => {
    expect(textNeurons(TEXT_MODEL, { promptTokens: 1_000_000, completionTokens: 0 })).toBe(26668)
    expect(textNeurons(TEXT_MODEL, { promptTokens: 600, completionTokens: 120 })).toBe(Math.ceil((600 * 26668 + 120 * 204805) / 1e6))
    expect(textNeurons('@cf/unknown/model', { promptTokens: 1, completionTokens: 1 })).toBeUndefined()
  })
})

test.describe('quota rules', () => {
  test('counts per-visitor uses and stops at the daily limit', async () => {
    const rules = new QuotaRules(memoryStorage(), testConfig({ VISITOR_COOLDOWN_SECONDS: '0' }).quota)
    for (let i = 0; i < 3; i++) expect((await rules.reserve('v1', 'signature', NOON + i)).ok).toBe(true)
    expect(await rules.reserve('v1', 'signature', NOON + 10)).toEqual({ ok: false, error: 'daily_limit_reached' })
    expect((await rules.reserve('v2', 'signature', NOON + 10)).ok).toBe(true)
    expect((await rules.status('v1', NOON)).signatureRemaining).toBe(0)
  })

  test('enforces the cooldown between generations', async () => {
    const rules = new QuotaRules(memoryStorage(), testConfig().quota)
    expect((await rules.reserve('v1', 'signature', NOON)).ok).toBe(true)
    expect(await rules.reserve('v1', 'signature', NOON + 5000)).toEqual({ ok: false, error: 'rate_limited', retryAfterSeconds: 15 })
    expect((await rules.reserve('v1', 'signature', NOON + 20_000)).ok).toBe(true)
  })

  test('refuses everyone once the global budget is spent, before any AI call', async () => {
    // A cap of exactly two reservations.
    const rules = new QuotaRules(memoryStorage(), testConfig({ DAILY_NEURON_ALLOWANCE: String(TEXT_RESERVE * 2), BUDGET_FRACTION: '1' }).quota)
    expect((await rules.reserve('v1', 'signature', NOON)).ok).toBe(true)
    expect((await rules.reserve('v2', 'signature', NOON)).ok).toBe(true)
    expect(await rules.reserve('v3', 'signature', NOON)).toEqual({ ok: false, error: 'budget_exhausted' })
    expect(await rules.status('v3', NOON)).toEqual({ signatureRemaining: 0, creativeRemaining: 0, budgetRemaining: 0 })
  })

  test('settle replaces the estimate with actual usage, and keeps it when usage is unknown', async () => {
    const storage = memoryStorage()
    const rules = new QuotaRules(storage, testConfig().quota)
    const first = await rules.reserve('v1', 'signature', NOON)
    if (!first.ok) throw new Error('expected reservation')
    await rules.settle(first.reservation, 47.2)
    expect(storage.data.get(`spent:${utcDay(NOON)}`)).toBe(48)
    const second = await rules.reserve('v2', 'signature', NOON)
    if (!second.ok) throw new Error('expected reservation')
    await rules.settle(second.reservation, null)
    expect(storage.data.get(`spent:${utcDay(NOON)}`)).toBe(48 + TEXT_RESERVE)
  })

  test('a retry needs budget but does not use up the visitor quota or cooldown', async () => {
    const rules = new QuotaRules(memoryStorage(), testConfig().quota)
    await rules.reserve('v1', 'signature', NOON)
    expect((await rules.reserve('v1', 'signature', NOON + 1, false)).ok).toBe(true)
    expect((await rules.status('v1', NOON)).signatureRemaining).toBe(2)
  })

  test('resets at 00:00 UTC and purges earlier days', async () => {
    const storage = memoryStorage()
    const rules = new QuotaRules(storage, testConfig({ VISITOR_COOLDOWN_SECONDS: '0' }).quota)
    for (let i = 0; i < 3; i++) await rules.reserve('v1', 'signature', NOON + i)
    const nextDay = NOON + 24 * 60 * 60 * 1000
    expect((await rules.reserve('v1', 'signature', nextDay)).ok).toBe(true)
    expect(await rules.purgeOldDays(nextDay)).toBe(2)
    expect([...storage.data.keys()].every((key) => key.includes(utcDay(nextDay)))).toBe(true)
  })
})

test.describe('turnstile verification', () => {
  function fakeFetch(reply: unknown, status = 200) {
    const calls: Array<{ url: string; body: string }> = []
    const impl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) })
      return new Response(JSON.stringify(reply), { status })
    }) as unknown as typeof fetch
    return { impl, calls }
  }
  const base = { token: 'XXXX.DUMMY.TOKEN.XXXX', secret: 'test-secret', remoteIp: '203.0.113.7', expectedHostnames: new Set<string>() }

  test('posts secret, token and IP to siteverify and passes on success', async () => {
    const { impl, calls } = fakeFetch({ success: true, hostname: 'example.com' })
    expect(await verifyTurnstile({ ...base, fetchImpl: impl })).toEqual({ ok: true })
    expect(calls[0].url).toBe(SITEVERIFY_URL)
    expect(new URLSearchParams(calls[0].body).get('response')).toBe(base.token)
    expect(new URLSearchParams(calls[0].body).get('remoteip')).toBe(base.remoteIp)
  })

  test('fails on rejection, hostname mismatch, HTTP errors, network errors and a missing secret', async () => {
    expect(await verifyTurnstile({ ...base, fetchImpl: fakeFetch({ success: false, 'error-codes': ['timeout-or-duplicate'] }).impl }))
      .toEqual({ ok: false, reason: 'rejected', errorCodes: ['timeout-or-duplicate'] })
    expect(await verifyTurnstile({ ...base, expectedHostnames: new Set([new URL(ORIGIN).hostname]), fetchImpl: fakeFetch({ success: true, hostname: 'example.com' }).impl }))
      .toEqual({ ok: false, reason: 'hostname_mismatch' })
    expect((await verifyTurnstile({ ...base, fetchImpl: fakeFetch({}, 500).impl })).ok).toBe(false)
    expect((await verifyTurnstile({ ...base, fetchImpl: (async () => { throw new TypeError('offline') }) as unknown as typeof fetch })).ok).toBe(false)
    expect(await verifyTurnstile({ ...base, secret: '', fetchImpl: fakeFetch({ success: true }).impl })).toEqual({ ok: false, reason: 'unavailable' })
  })
})

test.describe('generate/message handler', () => {
  test('returns validated AI text mapped onto existing templates and fonts', async () => {
    const { deps, storage } = makeDeps()
    const response = await handleRequest(post(validBody), deps)
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ message: GOOD_MESSAGE, templateId: 'birthday-party-01', messageFont: 'caveat', source: 'ai' })
    expect(storage.data.get(`spent:${utcDay(NOON)}`)).toBe(textNeurons(TEXT_MODEL, { promptTokens: 600, completionTokens: 120 }))
  })

  test('substitutes the deterministic design when the model suggests an invalid one', async () => {
    const { provider } = scriptedProvider([aiOutput({ message: GOOD_MESSAGE, templateId: '../../etc', messageFont: 'wingdings' })])
    const body = await (await handleRequest(post(validBody), makeDeps({ provider }).deps)).json()
    expect(body.templateId).toBe(pickTemplateId('Birthday', 'whimsical'))
    expect(body.messageFont).toBe(pickMessageFont('playful'))
  })

  test('keeps a personal message verbatim with no AI call and no quota use', async () => {
    const { provider, calls } = scriptedProvider([aiOutput({ message: GOOD_MESSAGE })])
    const { deps, storage } = makeDeps({ provider })
    const personalMessage = 'Happy birthday, you legend! 🎂 Dinner is on me.'
    const body = await (await handleRequest(post({ ...validBody, personalMessage }), deps)).json()
    expect(body).toMatchObject({ message: personalMessage, source: 'user' })
    expect(calls).toHaveLength(0)
    expect(storage.data.size).toBe(0)
  })

  test('retries invalid output exactly once, counting the visitor only once', async () => {
    const { provider, calls } = scriptedProvider([aiOutput('not json'), aiOutput({ message: GOOD_MESSAGE })])
    const { deps, rules } = makeDeps({ provider })
    expect((await handleRequest(post(validBody), deps)).status).toBe(200)
    expect(calls).toHaveLength(2)
    expect((await rules.status('visitor-203.0.113.7', NOON)).signatureRemaining).toBe(2)
  })

  test('gives up after one retry: provider errors, timeouts and bad output never loop', async () => {
    for (const outputs of [[new Error('upstream 500')], ['hang' as const], [aiOutput({ message: '<b>hi</b>' })]]) {
      const { provider, calls } = scriptedProvider(outputs)
      const response = await handleRequest(post(validBody), makeDeps({ provider }).deps)
      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({ error: 'generation_failed' })
      expect(calls).toHaveLength(2)
    }
  })

  test('keeps the full reservation counted when a call fails without usage', async () => {
    const { provider } = scriptedProvider([new Error('upstream 500')])
    const { deps, storage } = makeDeps({ provider })
    await handleRequest(post(validBody), deps)
    // Two attempts (original and retry), neither reporting usage.
    expect(storage.data.get(`spent:${utcDay(NOON)}`)).toBe(TEXT_RESERVE * 2)
  })

  test('makes no AI call when the budget is exhausted, the visitor is limited, or verification fails', async () => {
    const exhausted = scriptedProvider([aiOutput({ message: GOOD_MESSAGE })])
    const tiny = makeDeps({ provider: exhausted.provider, config: testConfig({ DAILY_NEURON_ALLOWANCE: String(TEXT_RESERVE - 1), BUDGET_FRACTION: '1' }) })
    const response = await handleRequest(post(validBody), tiny.deps)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'budget_exhausted' })
    expect(exhausted.calls).toHaveLength(0)

    const limited = scriptedProvider([aiOutput({ message: GOOD_MESSAGE })])
    let clock = NOON
    const { deps } = makeDeps({ provider: limited.provider, now: () => clock })
    for (let i = 0; i < 3; i++) { await handleRequest(post(validBody), deps); clock += 21_000 }
    const fourth = await handleRequest(post(validBody), deps)
    expect(fourth.status).toBe(429)
    expect(await fourth.json()).toEqual({ error: 'daily_limit_reached' })
    expect(limited.calls).toHaveLength(3)

    const cooldown = await handleRequest(post(validBody), makeDeps().deps).then(async () => {
      const shared = makeDeps()
      await handleRequest(post(validBody), shared.deps)
      return handleRequest(post(validBody), shared.deps)
    })
    expect(cooldown.status).toBe(429)
    expect(await cooldown.json()).toEqual({ error: 'rate_limited', retryAfterSeconds: 20 })

    const unverified = scriptedProvider([aiOutput({ message: GOOD_MESSAGE })])
    const rejected = await handleRequest(post(validBody), makeDeps({ provider: unverified.provider, turnstile: async () => ({ ok: false, reason: 'rejected' }) }).deps)
    expect(rejected.status).toBe(403)
    expect(await rejected.json()).toEqual({ error: 'verification_failed' })
    const down = await handleRequest(post(validBody), makeDeps({ turnstile: async () => ({ ok: false, reason: 'unavailable' }) }).deps)
    expect(down.status).toBe(503)
    expect(unverified.calls).toHaveLength(0)
  })

  test('the kill switch and a missing IP secret refuse before Turnstile or AI', async () => {
    for (const config of [testConfig({ AI_ENABLED: 'false' }), testConfig({ IP_HASH_SECRET: '' })]) {
      const { provider, calls } = scriptedProvider([aiOutput({ message: GOOD_MESSAGE })])
      const harness = makeDeps({ provider, config })
      const response = await handleRequest(post(validBody), harness.deps)
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'ai_disabled' })
      expect(harness.turnstileCalls()).toBe(0)
      expect(calls).toHaveLength(0)
    }
  })

  test('rejects bad origins, bad bodies and unknown routes without touching AI', async () => {
    const { provider, calls } = scriptedProvider([aiOutput({ message: GOOD_MESSAGE })])
    const { deps } = makeDeps({ provider })
    const cases: Array<[Request, number, string]> = [
      [post(validBody, { origin: null }), 403, 'forbidden_origin'],
      [post(validBody, { origin: 'https://evil.example' }), 403, 'forbidden_origin'],
      [post('{not json'), 400, 'invalid_request'],
      [post(validBody, { contentType: 'text/plain' }), 400, 'invalid_request'],
      [post({ ...validBody, padding: 'x'.repeat(MAX_BODY_BYTES) }), 400, 'invalid_request'],
      [post({ ...validBody, occasion: 'Anniversary' }), 400, 'invalid_request'],
      [new Request('https://ai.example/v1/nope', { headers: { Origin: ORIGIN } }), 404, 'not_found'],
    ]
    for (const [request, status, code] of cases) {
      const response = await handleRequest(request, deps)
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ error: code })
    }
    expect((await handleRequest(post(validBody, { origin: 'https://evil.example' }), deps)).headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(calls).toHaveLength(0)
  })

  test('answers CORS preflight for allowed origins only', async () => {
    const { deps } = makeDeps()
    const preflight = (origin: string) => new Request('https://ai.example/v1/generate/message', { method: 'OPTIONS', headers: { Origin: origin } })
    const allowed = await handleRequest(preflight(ORIGIN), deps)
    expect(allowed.status).toBe(204)
    expect(allowed.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect((await handleRequest(preflight('https://evil.example'), deps)).status).toBe(403)
  })

  test('status reports remaining uses without Turnstile or AI, and reports disabled when off', async () => {
    const status = (deps: HandlerDeps) => handleRequest(new Request('https://ai.example/v1/status', { headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.7' } }), deps)
    const { deps, turnstileCalls } = makeDeps()
    expect(await (await status(deps)).json()).toEqual({ enabled: true, signatureRemaining: 3, creativeRemaining: 0 })
    await handleRequest(post(validBody), deps)
    expect(await (await status(deps)).json()).toEqual({ enabled: true, signatureRemaining: 2, creativeRemaining: 0 })
    expect(turnstileCalls()).toBe(1)
    expect(await (await status(makeDeps({ config: testConfig({ AI_ENABLED: 'false' }) }).deps)).json())
      .toEqual({ enabled: false, signatureRemaining: 0, creativeRemaining: 0 })
  })
})
