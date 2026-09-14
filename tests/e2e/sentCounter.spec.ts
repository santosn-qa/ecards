import { expect, test } from '@playwright/test'
import { fetchSentCount, incrementSentCounter } from '../../src/counter/sentCounter'

function stubFetch(impl: typeof fetch) {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return () => {
    globalThis.fetch = original
  }
}

test.describe('sentCounter pure logic', () => {
  test('fetchSentCount returns null without calling fetch when apiUrl is unset', async () => {
    let called = false
    const restore = stubFetch(async () => {
      called = true
      throw new Error('should not be called')
    })
    try {
      expect(await fetchSentCount(undefined)).toBeNull()
      expect(called).toBe(false)
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns the parsed count on a successful response', async () => {
    const restore = stubFetch(async () => new Response(JSON.stringify({ count: 42 }), { status: 200 }))
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBe(42)
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns null on a non-2xx response', async () => {
    const restore = stubFetch(async () => new Response('error', { status: 500 }))
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBeNull()
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns null on malformed JSON', async () => {
    const restore = stubFetch(async () => new Response('not json', { status: 200 }))
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBeNull()
    } finally {
      restore()
    }
  })

  test('fetchSentCount returns null when the request rejects (offline/blocked)', async () => {
    const restore = stubFetch(async () => {
      throw new Error('network error')
    })
    try {
      expect(await fetchSentCount('https://counter.example.test')).toBeNull()
    } finally {
      restore()
    }
  })

  test('incrementSentCounter does not call fetch when apiUrl is unset', () => {
    let called = false
    const restore = stubFetch(async () => {
      called = true
      return new Response()
    })
    try {
      incrementSentCounter(undefined)
      expect(called).toBe(false)
    } finally {
      restore()
    }
  })

  test('incrementSentCounter posts to the increment endpoint and never throws even when fetch rejects', () => {
    let requestedUrl: string | undefined
    let requestedMethod: string | undefined
    const restore = stubFetch(async (input, init) => {
      requestedUrl = String(input)
      requestedMethod = init?.method
      throw new Error('network error')
    })
    try {
      expect(() => incrementSentCounter('https://counter.example.test')).not.toThrow()
      expect(requestedUrl).toBe('https://counter.example.test/increment')
      expect(requestedMethod).toBe('POST')
    } finally {
      restore()
    }
  })
})
