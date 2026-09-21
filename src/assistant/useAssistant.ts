import { useCallback, useRef, useState } from 'react'

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}

export type DocumentSnapshot = {
  title: string
  text: string
  selection: string
}

const ENDPOINT = '/api/assistant'

function id() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Minimal SSE reader: the browser's EventSource cannot POST a body. */
async function* readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let split = buffer.indexOf('\n\n')
    while (split !== -1) {
      const chunk = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)

      let event = 'message'
      let data = ''
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7)
        if (line.startsWith('data: ')) data += line.slice(6)
      }
      if (data) yield { event, data: JSON.parse(data) as Record<string, unknown> }

      split = buffer.indexOf('\n\n')
    }
  }
}

export function useAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  // The ref is the authority, not the state. A setState updater does not run
  // when it is called - React defers it to the render phase - so reading the
  // new history out of one would hand the request an empty array.
  const history = useRef<ChatMessage[]>([])

  const commit = useCallback((next: ChatMessage[]) => {
    history.current = next
    setMessages(next)
  }, [])

  const stop = useCallback(() => {
    abort.current?.abort()
    abort.current = null
    setStreaming(false)
  }, [])

  const clear = useCallback(() => {
    abort.current?.abort()
    abort.current = null
    setStreaming(false)
    setError(null)
    commit([])
  }, [commit])

  const send = useCallback(
    async (prompt: string, document: DocumentSnapshot) => {
      const text = prompt.trim()
      if (!text) return

      setError(null)
      const outgoing: ChatMessage = { id: id(), role: 'user', content: text }
      const replyId = id()

      const turns = [...history.current, outgoing]
      commit([...turns, { id: replyId, role: 'assistant', content: '' }])

      const controller = new AbortController()
      abort.current = controller
      setStreaming(true)

      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: turns.map(({ role, content }) => ({ role, content })),
            document,
          }),
        })

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null)
          throw new Error(
            (detail as { error?: string } | null)?.error ??
              `The assistant is unreachable (${response.status}).`,
          )
        }

        for await (const { event, data } of readEvents(response.body)) {
          if (event === 'delta') {
            const piece = String(data.text ?? '')
            commit(
              history.current.map((message) =>
                message.id === replyId
                  ? { ...message, content: message.content + piece }
                  : message,
              ),
            )
          } else if (event === 'error') {
            throw new Error(String(data.message ?? 'The assistant failed.'))
          }
        }
      } catch (caught) {
        if ((caught as Error)?.name === 'AbortError') {
          // Stopped on purpose; keep whatever streamed so far.
        } else {
          setError((caught as Error)?.message ?? 'The assistant failed.')
          // Drop an empty bubble rather than leave it hanging.
          commit(
            history.current.filter((message) => !(message.id === replyId && !message.content)),
          )
        }
      } finally {
        abort.current = null
        setStreaming(false)
      }
    },
    [commit],
  )

  return { messages, streaming, error, send, stop, clear }
}
