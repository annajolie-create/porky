'use client'

import { useState } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { FilePdf } from '@phosphor-icons/react/dist/csr/FilePdf'
import { Globe } from '@phosphor-icons/react/dist/csr/Globe'
import { Trash } from '@phosphor-icons/react/dist/csr/Trash'
import { Button, Card, Dots, ErrorNote, Pill, cx } from '../ui'
import { useProject } from '@/lib/store'
import type { Source } from '@/lib/model'
import { inTextCitation } from '@/lib/apa'
import { countWords } from '@/lib/text'
import { summariseSource } from '@/lib/sources'

export function SourceCard({ source, compact }: { source: Source; compact?: boolean }) {
  const updateSource = useProject((s) => s.updateSource)
  const removeSource = useProject((s) => s.removeSource)
  const context = useProject((s) => s.context)
  const [showText, setShowText] = useState(false)

  const summarise = async () => {
    updateSource(source.id, { summaryStatus: 'loading', summaryError: undefined })
    try {
      const summary = await summariseSource(source, context)
      updateSource(source.id, { summary, summaryStatus: 'idle' })
    } catch (e) {
      updateSource(source.id, { summaryStatus: 'error', summaryError: (e as Error).message })
    }
  }

  const Icon = source.type === 'pdf' ? FilePdf : Globe

  return (
    <Card className={cx('p-4', compact && 'p-3')}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 size-8 shrink-0 rounded-md bg-paper text-ink-soft grid place-items-center">
          <Icon size={16} weight="regular" />
        </span>
        <div className="flex-1 min-w-0">
          <input
            value={source.title}
            onChange={(e) => updateSource(source.id, { title: e.target.value })}
            aria-label="Title"
            className="w-full bg-transparent text-[14.5px] font-semibold text-ink leading-snug outline-none rounded px-1 -mx-1 focus:bg-paper"
            placeholder="Title"
          />
          <div className="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
            <input
              value={source.authors.join(', ')}
              onChange={(e) =>
                updateSource(source.id, {
                  authors: e.target.value
                    .split(/[,;]/)
                    .map((a) => a.trim())
                    .filter(Boolean),
                })
              }
              aria-label="Authors"
              placeholder="Authors, comma separated"
              className="min-w-0 flex-1 bg-transparent outline-none rounded px-1 -mx-1 focus:bg-paper text-ink-soft"
            />
            <span aria-hidden>·</span>
            <input
              value={source.year}
              onChange={(e) => updateSource(source.id, { year: e.target.value.replace(/[^0-9a-z.]/gi, '').slice(0, 6) })}
              aria-label="Year"
              placeholder="Year"
              className="w-14 bg-transparent outline-none rounded px-1 -mx-1 focus:bg-paper text-ink-soft tabular-nums"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill tone="accent">{inTextCitation(source)}</Pill>
            <Pill>{source.type === 'pdf' ? 'PDF' : 'Link'}</Pill>
            <Pill>{countWords(source.text).toLocaleString()} words</Pill>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-accent truncate max-w-[220px]"
              >
                <ArrowSquareOut size={12} />
                {new URL(source.url).hostname}
              </a>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => removeSource(source.id)}
          aria-label="Remove source"
          className="text-muted hover:text-del rounded p-1 -m-1 transition-colors"
        >
          <Trash size={15} />
        </button>
      </div>

      {!compact ? (
        <p className="mt-3 text-[13px] text-ink-soft leading-relaxed">
          {source.snippet}
          {source.text.length > source.snippet.length ? (
            <button type="button" onClick={() => setShowText((v) => !v)} className="ml-1 text-accent hover:underline text-[12.5px]">
              {showText ? 'Hide text' : 'Show text'}
            </button>
          ) : null}
        </p>
      ) : null}

      {showText ? (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-paper p-3 text-[12px] leading-relaxed text-ink-soft font-sans">
          {source.text}
        </pre>
      ) : null}

      <div className="mt-3 border-t border-line pt-3">
        {source.summaryStatus === 'loading' ? (
          <Dots label="Summarising for your task" />
        ) : source.summary ? (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted">What it says about your question</span>
              <button type="button" onClick={summarise} className="text-[12px] text-muted hover:text-accent">
                Redo
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-ink">{source.summary}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={summarise}>
              Summarise
            </Button>
            {source.summaryStatus === 'error' && source.summaryError ? (
              <div className="flex-1">
                <ErrorNote message={source.summaryError} onRetry={summarise} />
              </div>
            ) : (
              <span className="text-[12px] text-muted">Relates the source to the task in the Context tab.</span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
