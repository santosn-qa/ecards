import { IMAGE_MODEL, IMAGE_STEPS, TEXT_MODEL, type TokenUsage } from './neurons'
import type { ChatMessage } from './prompt'

export type TextGeneration = {
  /** The model's output: a JSON string or an already-parsed object. Always validated by the caller. */
  raw: unknown
  model: string
  usage?: TokenUsage
}

/** Anything that can turn chat messages into card text. Swapping providers never touches the card renderer. */
export interface TextProvider {
  generate(messages: ChatMessage[], jsonSchema: object, signal: AbortSignal): Promise<TextGeneration>
}

export type ImageGeneration = {
  /** The model's raw output object (expected `{ image: base64 JPEG }`). Always validated by the caller. */
  raw: unknown
  model: string
  steps: number
  /** Neurons Workers AI reported for the call, when it did. */
  reportedNeurons?: number
}

/** Anything that can turn a prompt into an illustration. Swapping providers never touches the card renderer. */
export interface ImageProvider {
  generate(prompt: string, signal: AbortSignal): Promise<ImageGeneration>
}

function reportedNeurons(usage: Record<string, unknown>): number | undefined {
  const neurons = usage.neurons
  return typeof neurons === 'number' && Number.isFinite(neurons) && neurons >= 0 ? neurons : undefined
}

export function readUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== 'object') return undefined
  const usage = value as Record<string, unknown>
  const promptTokens = usage.prompt_tokens
  const completionTokens = usage.completion_tokens
  if (typeof promptTokens !== 'number' || typeof completionTokens !== 'number') return undefined
  const neurons = reportedNeurons(usage)
  return { promptTokens, completionTokens, ...(neurons !== undefined ? { reportedNeurons: neurons } : {}) }
}

/** Cloudflare Workers AI text generation through the `AI` binding. */
export function workersAiTextProvider(ai: Ai): TextProvider {
  return {
    async generate(messages, jsonSchema, signal) {
      const output = (await ai.run(
        TEXT_MODEL,
        {
          messages,
          response_format: { type: 'json_schema', json_schema: jsonSchema },
          max_tokens: 250,
          temperature: 0.8,
        },
        { signal },
      )) as { response?: unknown; usage?: unknown }
      return { raw: output.response, model: TEXT_MODEL, usage: readUsage(output.usage) }
    },
  }
}

/** Cloudflare Workers AI image generation (flux-1-schnell). The model has no width/height inputs; it returns 1024x1024 JPEGs. */
export function workersAiImageProvider(ai: Ai): ImageProvider {
  return {
    async generate(prompt, signal) {
      const output = (await ai.run(IMAGE_MODEL, { prompt, steps: IMAGE_STEPS }, { signal })) as Record<string, unknown>
      const usage = output.usage && typeof output.usage === 'object' ? (output.usage as Record<string, unknown>) : {}
      return { raw: output, model: IMAGE_MODEL, steps: IMAGE_STEPS, reportedNeurons: reportedNeurons(usage) }
    },
  }
}
