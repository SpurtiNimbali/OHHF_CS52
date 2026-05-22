import OpenAI from 'openai'

const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1'

/** True when requests should go through OpenRouter (not api.openai.com). */
export function useOpenRouter(): boolean {
  if ((process.env.OPENROUTER_API_KEY ?? '').trim()) return true
  const base = (process.env.OPENROUTER_BASE_URL ?? process.env.OPENAI_BASE_URL ?? '').trim()
  return base.includes('openrouter.ai')
}

export function getLlmApiKey(): string {
  const key = (process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? '').trim()
  if (!key) {
    throw new Error('Missing OPENROUTER_API_KEY (or OPENAI_API_KEY)')
  }
  return key
}

function getLlmBaseUrl(): string | undefined {
  const explicit = (process.env.OPENROUTER_BASE_URL ?? process.env.OPENAI_BASE_URL ?? '').trim()
  if (explicit) return explicit
  if ((process.env.OPENROUTER_API_KEY ?? '').trim()) return OPENROUTER_DEFAULT_BASE
  return undefined
}

/** OpenAI SDK client — points at OpenRouter when configured, else OpenAI. */
let client: OpenAI | null = null
export function getLlmClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: getLlmApiKey(),
      baseURL: getLlmBaseUrl(),
    })
  }
  return client
}

/** OpenRouter model ids use `provider/model` (e.g. `openai/gpt-4o-mini`). */
export function resolveLlmModel(model: string): string {
  const m = model.trim()
  if (!useOpenRouter() || m.includes('/')) return m
  if (m.startsWith('gpt-') || m.startsWith('text-embedding') || m.startsWith('o1') || m.startsWith('o3')) {
    return `openai/${m}`
  }
  return m
}
