import 'server-only'

/**
 * The only file that talks to OpenRouter. Runs in route handlers, never in
 * the browser, so OPENROUTER_API_KEY stays on the server.
 */

export const MODELS = {
  strong: process.env.MODEL_STRONG || 'anthropic/claude-sonnet-5',
  cheap: process.env.MODEL_CHEAP || 'google/gemini-3.5-flash-lite',
  jev: process.env.MODEL_JEV || '~typesafe/jev-latest',
}

const BASE = 'https://openrouter.ai/api'

export class AIError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!key) {
    throw new AIError(
      'No OpenRouter key. Copy .env.example to .env.local, add OPENROUTER_API_KEY and restart the dev server.',
      503,
    )
  }
  return key
}

function headers() {
  return {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://porky.local',
    'X-Title': 'Porky essay editor',
  }
}

async function describeFailure(response: Response): Promise<AIError> {
  const text = await response.text().catch(() => '')
  let detail = text
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string }
    detail =
      typeof parsed.error === 'string' ? parsed.error : parsed.error?.message ?? text
  } catch {
    // keep raw text
  }
  const friendly: Record<number, string> = {
    401: 'OpenRouter rejected the API key. Check .env.local.',
    402: 'OpenRouter account has no credits left.',
    429: 'Rate limited by OpenRouter. Wait a moment and retry.',
  }
  return new AIError(
    friendly[response.status] ?? `OpenRouter error ${response.status}: ${detail.slice(0, 300)}`,
    response.status,
  )
}

// ---------------------------------------------------------------- chat

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

export type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

type ChatOptions = {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
  jsonSchema?: { name: string; schema: Record<string, unknown> }
  signal?: AbortSignal
}

function chatBody(options: ChatOptions, stream: boolean) {
  const body: Record<string, unknown> = {
    model: options.model ?? MODELS.strong,
    messages: options.messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 4000,
    stream,
  }
  if (options.tools?.length) body.tools = options.tools
  if (options.jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: options.jsonSchema.name, strict: true, schema: options.jsonSchema.schema },
    }
  }
  return body
}

export type ChatResult = {
  content: string
  toolCalls: ToolCall[]
  finishReason: string | null
}

/** One non-streaming completion. */
export async function chat(options: ChatOptions): Promise<ChatResult> {
  const response = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(chatBody(options, false)),
    signal: options.signal,
  })
  if (!response.ok) throw await describeFailure(response)
  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[]
    error?: { message?: string }
  }
  if (data.error) throw new AIError(data.error.message ?? 'OpenRouter error')
  const choice = data.choices?.[0]
  return {
    content: choice?.message?.content ?? '',
    toolCalls: choice?.message?.tool_calls ?? [],
    finishReason: choice?.finish_reason ?? null,
  }
}

/** Pulls the first JSON object out of a model reply that may have prose around it. */
export function extractJSON<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T
    const aStart = trimmed.indexOf('[')
    const aEnd = trimmed.lastIndexOf(']')
    if (aStart >= 0 && aEnd > aStart) return JSON.parse(trimmed.slice(aStart, aEnd + 1)) as T
    throw new AIError('The model did not return valid JSON.')
  }
}

/** Structured output: asks for a JSON schema and parses defensively. */
export async function chatJSON<T>(options: ChatOptions & { jsonSchema: { name: string; schema: Record<string, unknown> } }): Promise<T> {
  let result: ChatResult
  try {
    result = await chat({ ...options, temperature: options.temperature ?? 0.2 })
  } catch (error) {
    // Some providers reject response_format; retry once asking in the prompt.
    if (error instanceof AIError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 402 && error.status !== 429) {
      const { jsonSchema, ...rest } = options
      result = await chat({
        ...rest,
        messages: [
          ...rest.messages,
          {
            role: 'user',
            content: `Respond with only a JSON object matching this schema, no prose:\n${JSON.stringify(jsonSchema.schema)}`,
          },
        ],
        temperature: 0.2,
      })
    } else {
      throw error
    }
  }
  return extractJSON<T>(result.content)
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }
  | { type: 'finish'; reason: string | null }

/** Streaming completion; accumulates tool-call fragments into whole calls. */
export async function* chatStream(options: ChatOptions): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(chatBody(options, true)),
    signal: options.signal,
  })
  if (!response.ok || !response.body) throw await describeFailure(response)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const calls = new Map<number, ToolCall>()
  let finish: string | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl = buffer.indexOf('\n')
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      nl = buffer.indexOf('\n')
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') continue
      let json: {
        choices?: {
          delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }
          finish_reason?: string | null
        }[]
        error?: { message?: string }
      }
      try {
        json = JSON.parse(payload)
      } catch {
        continue
      }
      if (json.error) throw new AIError(json.error.message ?? 'OpenRouter error')
      const choice = json.choices?.[0]
      if (!choice) continue
      if (choice.delta?.content) yield { type: 'text', text: choice.delta.content }
      for (const fragment of choice.delta?.tool_calls ?? []) {
        const existing = calls.get(fragment.index)
        if (!existing) {
          calls.set(fragment.index, {
            id: fragment.id ?? `call_${fragment.index}`,
            type: 'function',
            function: { name: fragment.function?.name ?? '', arguments: fragment.function?.arguments ?? '' },
          })
        } else {
          if (fragment.id) existing.id = fragment.id
          if (fragment.function?.name) existing.function.name += fragment.function.name
          if (fragment.function?.arguments) existing.function.arguments += fragment.function.arguments
        }
      }
      if (choice.finish_reason) finish = choice.finish_reason
    }
  }

  if (calls.size) yield { type: 'tool_calls', toolCalls: Array.from(calls.values()) }
  yield { type: 'finish', reason: finish }
}

// ---------------------------------------------------------------- Jev

export type NoulQuestion = { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
export type ChoiceQuestion = { type: 'choice'; instructions: string; criteria: Record<string, string> }
export type ScoreQuestion = { type: 'score'; instructions: string; criteria: string[] }
export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion

export type NoulAnswer = { type: 'noul'; noul: number }
export type ChoiceAnswer = { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
export type ScoreAnswer = { type: 'score'; score: number; probabilities: Record<string, number>; confidence: number }
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer

export type DecideResult = {
  answers: Record<string, Answer>
  /** Which engine produced the answers; shown nowhere, logged for debugging. */
  engine: 'jev' | 'llm'
}

/**
 * Jev judges `state` against typed questions and returns probabilities. If
 * the Decisions endpoint fails for any reason, a cheap LLM answers the same
 * questions with structured output so the demo never depends on one service.
 */
export async function decide(
  state: unknown,
  questions: Record<string, Question>,
  signal?: AbortSignal,
): Promise<DecideResult> {
  try {
    const response = await fetch(`${BASE}/alpha/decisions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ model: MODELS.jev, state, questions }),
      signal,
    })
    if (!response.ok) throw await describeFailure(response)
    const data = (await response.json()) as Record<string, unknown>
    const answers = normaliseJev(data, questions)
    if (answers) return { answers, engine: 'jev' }
    throw new AIError('Unexpected Decisions API response shape')
  } catch (error) {
    if (error instanceof AIError && (error.status === 401 || error.status === 402)) throw error
    if ((error as Error)?.name === 'AbortError') throw error
    return { answers: await decideWithLLM(state, questions, signal), engine: 'llm' }
  }
}

function normaliseJev(data: Record<string, unknown>, questions: Record<string, Question>): Record<string, Answer> | null {
  const candidates = [data.answers, data.result, data.decisions, data]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const record = candidate as Record<string, unknown>
    const keys = Object.keys(questions)
    if (keys.every((k) => k in record)) {
      const out: Record<string, Answer> = {}
      for (const key of keys) {
        const raw = record[key] as Record<string, unknown>
        const q = questions[key]
        if (q.type === 'noul') {
          const value = typeof raw === 'number' ? raw : Number(raw?.noul ?? raw?.probability ?? raw?.value)
          out[key] = { type: 'noul', noul: clamp(value) }
        } else if (q.type === 'choice') {
          const probabilities = (raw?.probabilities as Record<string, number>) ?? {}
          const choice = String(raw?.choice ?? topKey(probabilities))
          out[key] = { type: 'choice', choice, probabilities, confidence: clamp(Number(raw?.confidence ?? Math.max(...Object.values(probabilities), 0))) }
        } else {
          const probabilities = (raw?.probabilities as Record<string, number>) ?? {}
          out[key] = { type: 'score', score: Number(raw?.score ?? 0), probabilities, confidence: clamp(Number(raw?.confidence ?? 0)) }
        }
      }
      return out
    }
  }
  return null
}

function topKey(probabilities: Record<string, number>): string {
  let best = ''
  let value = -1
  for (const [k, v] of Object.entries(probabilities)) {
    if (v > value) {
      best = k
      value = v
    }
  }
  return best
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0.5
  return Math.max(0, Math.min(1, n))
}

async function decideWithLLM(
  state: unknown,
  questions: Record<string, Question>,
  signal?: AbortSignal,
): Promise<Record<string, Answer>> {
  const properties: Record<string, unknown> = {}
  for (const [key, q] of Object.entries(questions)) {
    if (q.type === 'noul') {
      properties[key] = { type: 'number', description: `Probability (0-1) that the answer to "${q.instructions}" is yes.` }
    } else if (q.type === 'choice') {
      properties[key] = {
        type: 'object',
        properties: {
          choice: { type: 'string', enum: Object.keys(q.criteria) },
          confidence: { type: 'number' },
        },
        required: ['choice', 'confidence'],
        additionalProperties: false,
      }
    } else {
      properties[key] = {
        type: 'object',
        properties: {
          level: { type: 'integer', minimum: 0, maximum: q.criteria.length - 1 },
          confidence: { type: 'number' },
        },
        required: ['level', 'confidence'],
        additionalProperties: false,
      }
    }
  }
  const schema = { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
  const prompt = [
    'You are a calibrated judge. Judge the STATE against each QUESTION and answer with the exact JSON shape requested.',
    'For probabilities, 0.5 means you cannot tell. Be decisive when the evidence is clear.',
    '',
    `STATE:\n${typeof state === 'string' ? state : JSON.stringify(state, null, 2)}`,
    '',
    `QUESTIONS:\n${JSON.stringify(questions, null, 2)}`,
  ].join('\n')

  const raw = await chatJSON<Record<string, unknown>>({
    model: MODELS.cheap,
    messages: [{ role: 'user', content: prompt }],
    jsonSchema: { name: 'decisions', schema },
    maxTokens: 1000,
    signal,
  })

  const out: Record<string, Answer> = {}
  for (const [key, q] of Object.entries(questions)) {
    const value = raw[key] as Record<string, unknown> | number | undefined
    if (q.type === 'noul') {
      out[key] = { type: 'noul', noul: clamp(typeof value === 'number' ? value : Number((value as Record<string, unknown>)?.noul ?? 0.5)) }
    } else if (q.type === 'choice') {
      const v = (value ?? {}) as Record<string, unknown>
      const choice = String(v.choice ?? Object.keys(q.criteria)[0])
      const confidence = clamp(Number(v.confidence ?? 0.7))
      const probabilities: Record<string, number> = {}
      const others = Object.keys(q.criteria).filter((k) => k !== choice)
      for (const k of Object.keys(q.criteria)) probabilities[k] = k === choice ? confidence : others.length ? (1 - confidence) / others.length : 0
      out[key] = { type: 'choice', choice, probabilities, confidence }
    } else {
      const v = (value ?? {}) as Record<string, unknown>
      const level = Math.max(0, Math.min(q.criteria.length - 1, Number(v.level ?? 0)))
      const confidence = clamp(Number(v.confidence ?? 0.7))
      const probabilities: Record<string, number> = {}
      q.criteria.forEach((_, i) => (probabilities[String(i)] = i === level ? confidence : 0))
      out[key] = { type: 'score', score: level, probabilities, confidence }
    }
  }
  return out
}

// ---------------------------------------------------------------- helpers for routes

export function jsonError(error: unknown): Response {
  const status = error instanceof AIError ? error.status : 500
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 })
}

export function sseResponse(run: (emit: (event: string, data: unknown) => void, signal: AbortSignal) => Promise<void>, request: Request): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const emit = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      try {
        await run(emit, request.signal)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          emit('error', { message: error instanceof Error ? error.message : 'Something went wrong.' })
        }
      } finally {
        closed = true
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
