/**
 * HMAC-SHA256 of the visitor's IP, keyed with a Worker secret, so quota keys
 * can't be reversed with a precomputed table of the IPv4 space. Same approach
 * as the sent-counter Worker. Truncated to 16 hex characters: enough to tell
 * visitors apart, and not an identifier anywhere else.
 */
export async function hashVisitor(ip: string, secret: string): Promise<string> {
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
