/** Minimal SSE reader for POST responses; the browser's EventSource cannot POST. */
export async function* readEvents(body: ReadableStream<Uint8Array>) {
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
      if (data) {
        try {
          yield { event, data: JSON.parse(data) as Record<string, unknown> }
        } catch {
          // Malformed chunk; skip it rather than kill the stream.
        }
      }
      split = buffer.indexOf('\n\n')
    }
  }
}

/** Reads a JSON response and turns non-2xx into a thrown Error with the server's message. */
export async function postJSON<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = null
  }
  if (!response.ok) {
    const message =
      (parsed as { error?: string } | null)?.error ?? `Request failed (${response.status}).`
    throw new Error(message)
  }
  return parsed as T
}
