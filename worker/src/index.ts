export interface Env {
  COUNTER_KV: KVNamespace
  IP_HASH_SECRET: string
}

// Replace with the real production origin(s) before deploying. GitHub Pages
// URL is included so the default deployment target works out of the box.
const ALLOWED_ORIGINS = new Set<string>([
  'https://nourileesantos.github.io',
])

const COUNT_KEY = 'sent_count'
const DEBOUNCE_TTL_SECONDS = 60 // Cloudflare KV's minimum expirationTtl.

// Parses a KV-stored count string, falling back to 0 for anything missing
// or non-numeric (e.g. corrupted data) so a bad value can never permanently
// poison the counter.
function parseCount(raw: string | null): number {
  if (raw === null) return 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

// HMAC-SHA256 keyed with a Worker secret, so the per-IP debounce key can't be
// reversed via a precomputed table of the (small) IPv4 address space by
// anyone with read access to KV during the 60-second TTL window.
async function hashIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }
  return headers
}

function errorResponse(headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'temporarily unavailable' }), {
    status: 503,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const headers = corsHeaders(origin)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...headers,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (request.method === 'GET' && url.pathname === '/count') {
      try {
        const raw = await env.COUNTER_KV.get(COUNT_KEY)
        return new Response(JSON.stringify({ count: parseCount(raw) }), { headers })
      } catch (err) {
        console.error('GET /count failed', err)
        return errorResponse(headers)
      }
    }

    if (request.method === 'POST' && url.pathname === '/increment') {
      try {
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
        const debounceKey = `debounce:${await hashIp(ip, env.IP_HASH_SECRET)}`
        const [alreadyRecent, raw] = await Promise.all([
          env.COUNTER_KV.get(debounceKey),
          env.COUNTER_KV.get(COUNT_KEY),
        ])
        const current = parseCount(raw)

        if (alreadyRecent) {
          return new Response(JSON.stringify({ count: current }), { headers })
        }

        const next = current + 1
        await Promise.all([
          env.COUNTER_KV.put(COUNT_KEY, String(next)),
          env.COUNTER_KV.put(debounceKey, '1', { expirationTtl: DEBOUNCE_TTL_SECONDS }),
        ])
        return new Response(JSON.stringify({ count: next }), { headers })
      } catch (err) {
        console.error('POST /increment failed', err)
        return errorResponse(headers)
      }
    }

    return new Response('Not found', { status: 404, headers })
  },
}
