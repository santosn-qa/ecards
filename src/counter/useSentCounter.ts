import { useEffect, useState } from 'react'
import { fetchSentCount, incrementSentCounter } from './sentCounter'

export function useSentCounter() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSentCount().then((value) => {
      if (!cancelled) setCount(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function bump() {
    setCount((current) => (current === null ? current : current + 1))
    incrementSentCounter()
  }

  return { count, bump }
}
