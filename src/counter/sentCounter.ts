import { COUNTER_CONFIG } from '../config/counter'

export async function fetchSentCount(apiUrl: string | undefined = COUNTER_CONFIG.apiUrl): Promise<number | null> {
  if (!apiUrl) return null
  try {
    const response = await fetch(`${apiUrl}/count`)
    if (!response.ok) return null
    const data = (await response.json()) as { count?: unknown }
    return typeof data.count === 'number' ? data.count : null
  } catch {
    return null
  }
}

export function incrementSentCounter(apiUrl: string | undefined = COUNTER_CONFIG.apiUrl): void {
  if (!apiUrl) return
  fetch(`${apiUrl}/increment`, { method: 'POST' }).catch(() => {
    // Best-effort only — a failed increment never affects the card flow.
  })
}
