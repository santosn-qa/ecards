import { SUPPORT_CONFIG } from '../config/support'

export function SupportFooterLink() {
  if (!SUPPORT_CONFIG.enabled) return null
  return (
    <a href={SUPPORT_CONFIG.url} target="_blank" rel="noopener noreferrer">
      Support Little Hello
    </a>
  )
}
