import { TEXT_MODEL, type TokenUsage } from './neurons'
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

function readUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== 'object') return undefined
  const usage = value as Record<string, unknown>
  const promptTokens = usage.prompt_tokens
  const completionTokens = usage.completion_tokens
  if (typeof promptTokens !== 'number' || typeof completionTokens !== 'number') return undefined
  return { promptTokens, completionTokens }
}

/** Cloudflare Workers AI through the `AI` binding. Not exercised against the real service until Milestone 3. */
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
