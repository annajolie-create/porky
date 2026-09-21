'use client'

import { newId } from './ids'
import type { Context, Source } from './model'
import { postJSON } from './sse'

type Extracted = {
  text: string
  title: string
  authors: string[]
  year: string
  snippet: string
  url?: string
}

async function parseResponse(response: Response): Promise<Extracted> {
  const data = (await response.json().catch(() => null)) as (Extracted & { error?: string }) | null
  if (!response.ok || !data || !data.text) throw new Error(data?.error ?? `Could not read that source (${response.status}).`)
  return data
}

export async function sourceFromFile(file: File): Promise<Source> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch('/api/sources/extract', { method: 'POST', body: form })
  const data = await parseResponse(response)
  return toSource(data, 'pdf')
}

export async function sourceFromUrl(url: string): Promise<Source> {
  const response = await fetch('/api/sources/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await parseResponse(response)
  return toSource(data, 'link')
}

function toSource(data: Extracted, type: Source['type']): Source {
  return {
    id: newId('src'),
    type,
    title: data.title,
    authors: data.authors,
    year: data.year,
    url: data.url,
    text: data.text,
    snippet: data.snippet,
    summaryStatus: 'idle',
    addedAt: Date.now(),
  }
}

export async function summariseSource(source: Source, context: Context): Promise<string> {
  const { summary } = await postJSON<{ summary: string }>('/api/sources/summarise', {
    source: { title: source.title, authors: source.authors, year: source.year, text: source.text },
    context: {
      task: context.task,
      framework: context.framework,
      grading: context.grading,
      lengthWords: context.lengthWords,
      style: context.style,
      language: context.language,
    },
  })
  return summary
}
