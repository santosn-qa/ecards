const SUPPRESSION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const SUPPORT_DISMISS_STORAGE_KEY = 'littleHelloSupportDismissedAt'

export function shouldShowSupportPrompt(now: number, dismissedAt: number | null, enabled: boolean): boolean {
  if (!enabled) return false
  if (dismissedAt === null) return true
  return now - dismissedAt >= SUPPRESSION_WINDOW_MS
}

export function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(SUPPORT_DISMISS_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function recordDismissal(now: number): void {
  try {
    localStorage.setItem(SUPPORT_DISMISS_STORAGE_KEY, String(now))
  } catch {
    // localStorage unavailable (private mode, quota, disabled) — fail open.
  }
}
