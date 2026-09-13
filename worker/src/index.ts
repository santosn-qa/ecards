export interface Env {
  COUNTER_KV: KVNamespace
}

// Replace with the real production origin(s) before deploying. GitHub Pages
// URL is included so the default deployment target works out of the box.
const ALLOWED_ORIGINS = new Set<string>([
  'https://nourileesantos.github.io',
])

const COUNT_KEY = 'sent_count'
const DEBOUNCE_TTL_SECONDS = 60 // Cloudflare KV's minimum expirationTtl.

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
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
      const raw = await env.COUNTER_KV.get(COUNT_KEY)
      const count = raw ? Number(raw) : 0
      return new Response(JSON.stringify({ count }), { headers })
    }

    if (request.method === 'POST' && url.pathname === '/increment') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      const debounceKey = `debounce:${await hashIp(ip)}`
      const [alreadyRecent, raw] = await Promise.all([
        env.COUNTER_KV.get(debounceKey),
        env.COUNTER_KV.get(COUNT_KEY),
      ])
      const current = raw ? Number(raw) : 0

      if (alreadyRecent) {
        return new Response(JSON.stringify({ count: current }), { headers })
      }

      const next = current + 1
      await Promise.all([
        env.COUNTER_KV.put(COUNT_KEY, String(next)),
        env.COUNTER_KV.put(debounceKey, '1', { expirationTtl: DEBOUNCE_TTL_SECONDS }),
      ])
      return new Response(JSON.stringify({ count: next }), { headers })
    }

    return new Response('Not found', { status: 404, headers })
  },
}
