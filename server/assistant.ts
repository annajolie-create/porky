import Anthropic from '@anthropic-ai/sdk'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Runs in Node, inside the Vite server — never in the browser. The API key
 * therefore stays out of the client bundle, which matters because this app is
 * otherwise a static site that anyone opening the page could read.
 */

const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 16000
/** Haiku 4.5 holds 200K tokens; this is the point where we say so out loud. */
const MAX_DOCUMENT_CHARS = 400_000

const SYSTEM = `You are the writing assistant built into Porky, a browser word processor.
You sit in a side panel next to the document the user is writing.

How to help:
- You can see the document. Refer to what is actually in it; never invent passages.
- When asked to rewrite or draft, return the prose itself, ready to paste. No preamble, no "here's your text".
- When asked for feedback, be specific and concrete: quote the phrase you mean, say what is wrong, offer the fix.
- Match the register of the document. An academic essay is not a blog post.

Style: plain, direct, brief. Never open with flattery. Do not use headings for a two-sentence answer.
Plain prose by default; use markdown only for lists or code when the content genuinely calls for it.
If the document is empty and the user asks about it, say so rather than guessing at their topic.`

export type AssistantRequest = {
  messages: { role: 'user' | 'assistant'; content: string }[]
  document?: { title?: string; text?: string; selection?: string }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      // A runaway body should fail fast rather than fill memory.
      if (data.length > 8_000_000) reject(new Error('Request body too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function buildContext(document: AssistantRequest['document']) {
  if (!document) return null

  const text = (document.text ?? '').trim()
  const parts = [`<document title="${(document.title ?? 'Untitled').replace(/"/g, "'")}">`]
  parts.push(text || '(The document is empty.)')
  parts.push('</document>')

  if (document.selection?.trim()) {
    parts.push('', '<selection>', document.selection.trim(), '</selection>')
    parts.push('', 'The user has the text in <selection> highlighted right now.')
  }

  return parts.join('\n')
}

export function createAssistantHandler(apiKey: string | undefined) {
  const client = apiKey ? new Anthropic({ apiKey }) : null

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST') {
      send(res, 405, { error: 'Use POST.' })
      return
    }

    if (!client) {
      send(res, 503, {
        error:
          'No API key. Copy .env.example to .env.local, add your Anthropic key, and restart the dev server.',
      })
      return
    }

    let payload: AssistantRequest
    try {
      payload = JSON.parse(await readBody(req)) as AssistantRequest
    } catch {
      send(res, 400, { error: 'Could not read the request.' })
      return
    }

    const history = Array.isArray(payload.messages) ? payload.messages : []
    if (!history.length) {
      send(res, 400, { error: 'No message to answer.' })
      return
    }

    const documentText = payload.document?.text ?? ''
    if (documentText.length > MAX_DOCUMENT_CHARS) {
      // Silently truncating would make the assistant confidently wrong about
      // the end of the document, which is worse than refusing.
      send(res, 413, {
        error: `This document is too long to send in full (${Math.round(
          documentText.length / 1000,
        )}k characters). Select the part you want help with and ask again.`,
      })
      return
    }

    const context = buildContext(payload.document)
    const messages: Anthropic.MessageParam[] = history.map((message, index) => {
      // The document rides along with the newest user turn, so it is always
      // current without duplicating a stale copy into every earlier turn.
      const isLast = index === history.length - 1
      if (isLast && message.role === 'user' && context) {
        return { role: 'user', content: `${context}\n\n${message.content}` }
      }
      return { role: message.role, content: message.content }
    })

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    const write = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        messages,
      })

      // If the reader navigates away or hits Stop, stop paying for tokens.
      req.on('close', () => stream.abort())

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          write('delta', { text: event.delta.text })
        }
      }

      const final = await stream.finalMessage()
      write('done', {
        stopReason: final.stop_reason,
        usage: {
          input: final.usage.input_tokens,
          output: final.usage.output_tokens,
        },
      })
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        write('error', { message: 'That API key was rejected. Check .env.local.' })
      } else if (error instanceof Anthropic.RateLimitError) {
        write('error', { message: 'Rate limited. Wait a moment and try again.' })
      } else if (error instanceof Anthropic.APIError) {
        write('error', { message: `Claude API error ${error.status}: ${error.message}` })
      } else if ((error as { name?: string })?.name === 'AbortError') {
        // The reader stopped it; nothing to report.
      } else {
        write('error', { message: (error as Error)?.message ?? 'Something went wrong.' })
      }
    } finally {
      res.end()
    }
  }
}
