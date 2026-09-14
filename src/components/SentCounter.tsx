type SentCounterProps = {
  count: number | null
}

export function SentCounter({ count }: SentCounterProps) {
  if (count === null) return null
  return (
    <p className="sent-counter">
      <span aria-hidden="true">💌</span> {count.toLocaleString()} Little Hellos sent so far
    </p>
  )
}
