'use client'

import { useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { Button, Dots, ErrorNote, Input } from '../ui'
import { useProject } from '@/lib/store'
import { rankPassages } from '@/lib/passages'
import { postJSON } from '@/lib/sse'

type Result = { sourceId: string; passage: string; explanation: string; score: number }

/**
 * "Which source talks about X?" Lexical overlap picks candidate passages
 * client-side; the server ranks and explains them.
 */
export function TopicSearch() {
  const sources = useProject((s) => s.sources)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    const q = query.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    try {
      const candidates = sources.flatMap((s) =>
        rankPassages(s.text, q, 3).map((p) => ({ sourceId: s.id, title: s.title, passage: p.text })),
      )
      const data = await postJSON<{ results: Result[] }>('/api/sources/search', { query: q, candidates })
      setResults(data.results)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run()
            }}
            placeholder='Ask which source covers a topic — e.g. "privacy risks of CBDCs"'
            className="pl-9 h-12 rounded-xl"
          />
        </div>
        <Button onClick={run} loading={busy} disabled={!query.trim()}>
          Search
        </Button>
      </div>
      {busy ? <div className="mt-3"><Dots label="Reading sources" /></div> : null}
      {error ? <div className="mt-3"><ErrorNote message={error} onRetry={run} /></div> : null}
      {results && !busy ? (
        <ul className="mt-3 space-y-2 fade-in">
          {results.length === 0 ? <li className="text-[13px] text-muted">None of your sources cover that.</li> : null}
          {results.map((r, i) => {
            const source = sources.find((s) => s.id === r.sourceId)
            if (!source) return null
            return (
              <li key={`${r.sourceId}-${i}`} className="rounded-md border border-line bg-surface p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium truncate">{source.title}</span>
                  <span className="text-[12px] text-muted shrink-0">{r.explanation}</span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                  <Highlighted text={r.passage} query={query} />
                </p>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
  if (!words.length) return <>{text}</>
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="bg-comment rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
